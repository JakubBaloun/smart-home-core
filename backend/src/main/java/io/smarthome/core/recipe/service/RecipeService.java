package io.smarthome.core.recipe.service;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.common.PageResponse;
import io.smarthome.core.common.exception.ResourceNotFoundException;
import io.smarthome.core.recipe.Recipe;
import io.smarthome.core.recipe.RecipeIngredient;
import io.smarthome.core.recipe.RecipeStep;
import io.smarthome.core.recipe.repository.RecipeRepository;
import io.smarthome.core.recipe.repository.TagRepository;
import io.smarthome.core.recipe.resource.IngredientRequest;
import io.smarthome.core.recipe.resource.RecipeDetailResponse;
import io.smarthome.core.recipe.resource.RecipeListResponse;
import io.smarthome.core.recipe.resource.RecipeMapper;
import io.smarthome.core.recipe.resource.RecipeRequest;
import io.smarthome.core.recipe.resource.StepRequest;
import io.smarthome.core.recipe.resource.TagMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.Session;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;

import java.time.OffsetDateTime;
import java.util.List;

@ApplicationScoped
public class RecipeService {

    private static final int DEFAULT_SERVINGS_BASE = 4;

    @Inject
    SessionFactory sessionFactory;

    @Inject
    RecipeRepository recipeRepository;

    @Inject
    TagRepository tagRepository;

    @Inject
    TagService tagService;

    @Inject
    RecipeMapper recipeMapper;

    @Inject
    TagMapper tagMapper;

    public Uni<PageResponse<RecipeListResponse>> searchRecipes(String search, List<String> tagNames, int page, int size) {
        String likePattern = (search == null || search.isBlank()) ? null : "%" + search.trim().toLowerCase() + "%";
        List<String> distinctTagNames = (tagNames == null) ? List.of() : tagNames.stream().distinct().toList();
        int tagCount = distinctTagNames.size();
        int offset = page * size;

        return sessionFactory.withSession(session ->
                        tagRepository.findIdsByNames(distinctTagNames, session)
                                // Hibernate Reactive sessions only support one in-flight operation at a time,
                                // so search/countSearch/per-recipe tag lookups must be chained, not combined.
                                .chain(tagIds -> recipeRepository.search(likePattern, tagIds, tagCount, offset, size, session)
                                        .chain(recipes -> recipeRepository.countSearch(likePattern, tagIds, tagCount, session)
                                                .chain(total -> Multi.createFrom().iterable(recipes)
                                                        .onItem().transformToUniAndConcatenate(recipe ->
                                                                recipeRepository.findTagsByRecipeId(recipe.getId(), session)
                                                                        .map(tags -> recipeMapper.toListResponse(recipe, tagMapper.toResponseList(tags))))
                                                        .collect().asList()
                                                        .map(items -> PageResponse.of(items, page, size, total)))))
                )
                .invoke(pageResponse -> Log.debugf("Retrieved %d recipe(s) (page %d of %d)",
                        pageResponse.items().size(), page, pageResponse.totalPages()))
                .onFailure().invoke(e -> Log.errorf("Failed to search recipes: %s", e.getMessage()));
    }

    public Uni<RecipeDetailResponse> getRecipeById(Long id) {
        return sessionFactory.withSession(session -> loadDetail(id, session))
                .invoke(response -> Log.debugf("Recipe with id %d retrieved successfully", id))
                .onFailure().invoke(e -> Log.errorf("Failed to retrieve recipe with id %d: %s", id, e.getMessage()));
    }

    public Uni<RecipeDetailResponse> createRecipe(RecipeRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Creating recipe '%s'", request.title()))
                .chain(() -> sessionFactory.withTransaction(session -> {
                    Recipe recipe = recipeMapper.toEntity(request);
                    if (recipe.getServingsBase() == null) {
                        recipe.setServingsBase(DEFAULT_SERVINGS_BASE);
                    }
                    return recipeRepository.save(recipe, session)
                            .chain(() -> persistIngredients(recipe.getId(), request.ingredients(), session))
                            .chain(() -> persistSteps(recipe.getId(), request.steps(), session))
                            .chain(() -> persistTags(recipe.getId(), request.tags(), session))
                            .chain(() -> loadDetail(recipe.getId(), session));
                }))
                .invoke(response -> Log.infof("Recipe '%s' created with id %d", response.title(), response.id()))
                .onFailure().invoke(e -> Log.errorf("Failed to create recipe '%s': %s", request.title(), e.getMessage()));
    }

    public Uni<RecipeDetailResponse> updateRecipe(Long id, RecipeRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Updating recipe with id %d", id))
                .chain(() -> sessionFactory.withTransaction(session ->
                        recipeRepository.findById(id, session)
                                .chain(recipe -> {
                                    if (recipe == null) {
                                        return Uni.createFrom().failure(new ResourceNotFoundException("Recipe", id));
                                    }
                                    recipe.setTitle(request.title());
                                    recipe.setDescription(request.description());
                                    recipe.setServingsBase(request.servingsBase() != null ? request.servingsBase() : DEFAULT_SERVINGS_BASE);
                                    recipe.setPrepTimeMinutes(request.prepTimeMinutes());
                                    recipe.setCookTimeMinutes(request.cookTimeMinutes());
                                    recipe.setNotes(request.notes());
                                    recipe.setUpdatedAt(OffsetDateTime.now());
                                    return recipeRepository.update(recipe, session)
                                            .chain(() -> recipeRepository.deleteIngredientsByRecipeId(id, session))
                                            .chain(() -> recipeRepository.deleteStepsByRecipeId(id, session))
                                            .chain(() -> recipeRepository.deleteTagLinksByRecipeId(id, session))
                                            .chain(() -> persistIngredients(id, request.ingredients(), session))
                                            .chain(() -> persistSteps(id, request.steps(), session))
                                            .chain(() -> persistTags(id, request.tags(), session))
                                            .chain(() -> loadDetail(id, session));
                                })
                ))
                .invoke(response -> Log.infof("Recipe with id %d updated successfully", id))
                .onFailure().invoke(e -> Log.errorf("Failed to update recipe with id %d: %s", id, e.getMessage()));
    }

    public Uni<Void> deleteRecipe(Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Deleting recipe with id %d", id))
                .chain(() -> sessionFactory.withTransaction(session ->
                        recipeRepository.findById(id, session)
                                .chain(recipe -> {
                                    if (recipe == null) {
                                        return Uni.createFrom().failure(new ResourceNotFoundException("Recipe", id));
                                    }
                                    return recipeRepository.delete(recipe, session);
                                })
                ))
                .invoke(() -> Log.infof("Recipe with id %d deleted successfully", id))
                .onFailure().invoke(e -> Log.errorf("Failed to delete recipe with id %d: %s", id, e.getMessage()));
    }

    private Uni<RecipeDetailResponse> loadDetail(Long recipeId, Session session) {
        return recipeRepository.findById(recipeId, session)
                .chain(recipe -> {
                    if (recipe == null) {
                        return Uni.createFrom().failure(new ResourceNotFoundException("Recipe", recipeId));
                    }
                    // Chained rather than combined: a Hibernate Reactive session only supports
                    // one in-flight operation at a time.
                    return recipeRepository.findIngredientsByRecipeId(recipeId, session)
                            .map(recipeMapper::toIngredientResponseList)
                            .chain(ingredients -> recipeRepository.findStepsByRecipeId(recipeId, session)
                                    .map(recipeMapper::toStepResponseList)
                                    .chain(steps -> recipeRepository.findTagsByRecipeId(recipeId, session)
                                            .map(tagMapper::toResponseList)
                                            .map(tags -> recipeMapper.toDetailResponse(recipe, ingredients, steps, tags))));
                });
    }

    private Uni<Void> persistIngredients(Long recipeId, List<IngredientRequest> ingredients, Session session) {
        return Multi.createFrom().iterable(indexed(ingredients))
                .onItem().transformToUniAndConcatenate(entry -> {
                    RecipeIngredient entity = recipeMapper.toIngredientEntity(entry.value());
                    entity.setRecipeId(recipeId);
                    entity.setSortOrder(entry.index());
                    return recipeRepository.saveIngredient(entity, session);
                })
                .collect().last()
                .replaceWithVoid();
    }

    private Uni<Void> persistSteps(Long recipeId, List<StepRequest> steps, Session session) {
        return Multi.createFrom().iterable(indexed(steps))
                .onItem().transformToUniAndConcatenate(entry -> {
                    RecipeStep entity = recipeMapper.toStepEntity(entry.value());
                    entity.setRecipeId(recipeId);
                    entity.setStepNumber(entry.index() + 1);
                    return recipeRepository.saveStep(entity, session);
                })
                .collect().last()
                .replaceWithVoid();
    }

    private Uni<Void> persistTags(Long recipeId, List<String> tagNames, Session session) {
        if (tagNames == null || tagNames.isEmpty()) {
            return Uni.createFrom().voidItem();
        }
        List<String> distinctTagNames = tagNames.stream().distinct().toList();
        return Multi.createFrom().iterable(distinctTagNames)
                .onItem().transformToUniAndConcatenate(name ->
                        tagService.findOrCreate(name, session)
                                .chain(tag -> recipeRepository.saveTagLink(recipeId, tag.getId(), session)))
                .collect().last()
                .replaceWithVoid();
    }

    private record IndexedItem<T>(int index, T value) {
    }

    private static <T> List<IndexedItem<T>> indexed(List<T> items) {
        return java.util.stream.IntStream.range(0, items.size())
                .mapToObj(i -> new IndexedItem<>(i, items.get(i)))
                .toList();
    }
}
