package io.smarthome.core.recipe.repository;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.recipe.Recipe;
import io.smarthome.core.recipe.RecipeIngredient;
import io.smarthome.core.recipe.RecipeStep;
import io.smarthome.core.recipe.Tag;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class RecipeRepositoryTest {

    @Inject
    RecipeRepository recipeRepository;

    @Inject
    TagRepository tagRepository;

    @Inject
    SessionFactory sessionFactory;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM RecipeTag").executeUpdate()
                        .chain(() -> session.createQuery("DELETE FROM RecipeIngredient").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM RecipeStep").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM Recipe").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM Tag").executeUpdate())
        ).await().indefinitely();
    }

    private Recipe newRecipe(String title) {
        return Recipe.builder().title(title).servingsBase(4).build();
    }

    private Long saveRecipe(Recipe recipe) {
        sessionFactory.withTransaction(session -> recipeRepository.save(recipe, session)).await().indefinitely();
        return recipe.getId();
    }

    private void saveIngredient(Long recipeId, String name, int sortOrder) {
        RecipeIngredient ingredient = RecipeIngredient.builder()
                .recipeId(recipeId)
                .name(name)
                .amount(BigDecimal.ONE)
                .sortOrder(sortOrder)
                .build();
        sessionFactory.withTransaction(session -> recipeRepository.saveIngredient(ingredient, session)).await().indefinitely();
    }

    private void saveStep(Long recipeId, int stepNumber) {
        RecipeStep step = RecipeStep.builder()
                .recipeId(recipeId)
                .stepNumber(stepNumber)
                .content("Do something")
                .build();
        sessionFactory.withTransaction(session -> recipeRepository.saveStep(step, session)).await().indefinitely();
    }

    private Long saveTag(String name) {
        Tag tag = Tag.builder().name(name).build();
        sessionFactory.withTransaction(session -> tagRepository.save(tag, session)).await().indefinitely();
        return tag.getId();
    }

    private void linkTag(Long recipeId, Long tagId) {
        sessionFactory.withTransaction(session -> recipeRepository.saveTagLink(recipeId, tagId, session)).await().indefinitely();
    }

    @Test
    void testSaveAndFindById() {
        Long id = saveRecipe(newRecipe("Goulash"));

        Recipe found = sessionFactory.withSession(session -> recipeRepository.findById(id, session)).await().indefinitely();

        assertNotNull(found, "Recipe should be found by ID");
        assertEquals("Goulash", found.getTitle());
    }

    @Test
    void testSearchMatchesByTitle() {
        saveRecipe(newRecipe("Beef Goulash"));
        saveRecipe(newRecipe("Chicken Soup"));

        List<Recipe> results = sessionFactory.withSession(session ->
                recipeRepository.search("%goulash%", List.of(), 0, 0, 20, session)
        ).await().indefinitely();

        assertEquals(1, results.size());
        assertEquals("Beef Goulash", results.get(0).getTitle());
    }

    @Test
    void testSearchMatchesByIngredientName() {
        Long id = saveRecipe(newRecipe("Mystery Dish"));
        saveIngredient(id, "stroužky česneku", 0);

        List<Recipe> results = sessionFactory.withSession(session ->
                recipeRepository.search("%česneku%", List.of(), 0, 0, 20, session)
        ).await().indefinitely();

        assertEquals(1, results.size());
        assertEquals(id, results.get(0).getId());
    }

    @Test
    void testSearchWithTwoTagsRequiresBoth() {
        Long quickId = saveRecipe(newRecipe("Quick Vegan Bowl"));
        Long onlyQuickId = saveRecipe(newRecipe("Just Quick"));
        Long quickTagId = saveTag("quick");
        Long veganTagId = saveTag("vegan");

        linkTag(quickId, quickTagId);
        linkTag(quickId, veganTagId);
        linkTag(onlyQuickId, quickTagId);

        List<Recipe> results = sessionFactory.withSession(session ->
                recipeRepository.search(null, List.of(quickTagId, veganTagId), 2, 0, 20, session)
        ).await().indefinitely();

        assertEquals(1, results.size());
        assertEquals(quickId, results.get(0).getId());
    }

    @Test
    void testPagination() {
        saveRecipe(newRecipe("Recipe A"));
        saveRecipe(newRecipe("Recipe B"));
        saveRecipe(newRecipe("Recipe C"));

        List<Recipe> page0 = sessionFactory.withSession(session ->
                recipeRepository.search(null, List.of(), 0, 0, 2, session)
        ).await().indefinitely();
        List<Recipe> page1 = sessionFactory.withSession(session ->
                recipeRepository.search(null, List.of(), 0, 2, 2, session)
        ).await().indefinitely();
        Long total = sessionFactory.withSession(session ->
                recipeRepository.countSearch(null, List.of(), 0, session)
        ).await().indefinitely();

        assertEquals(2, page0.size());
        assertEquals(1, page1.size());
        assertEquals(3L, total);
    }

    @Test
    void testDeleteCascadesChildrenButNotTag() {
        Long id = saveRecipe(newRecipe("To Delete"));
        saveIngredient(id, "Salt", 0);
        saveStep(id, 1);
        Long tagId = saveTag("shared-tag");
        linkTag(id, tagId);

        sessionFactory.withTransaction(session ->
                recipeRepository.findById(id, session).chain(recipe -> recipeRepository.delete(recipe, session))
        ).await().indefinitely();

        List<RecipeIngredient> ingredients = sessionFactory.withSession(session ->
                recipeRepository.findIngredientsByRecipeId(id, session)
        ).await().indefinitely();
        List<RecipeStep> steps = sessionFactory.withSession(session ->
                recipeRepository.findStepsByRecipeId(id, session)
        ).await().indefinitely();
        List<Tag> tags = sessionFactory.withSession(session -> tagRepository.listAll(session)).await().indefinitely();

        assertTrue(ingredients.isEmpty(), "Ingredients should be cascade-deleted");
        assertTrue(steps.isEmpty(), "Steps should be cascade-deleted");
        assertEquals(1, tags.size(), "Tag row should survive its recipe's deletion");
        assertEquals(tagId, tags.get(0).getId());
    }
}
