package io.smarthome.core.recipe.repository;

import io.smallrye.mutiny.Uni;
import io.smarthome.core.recipe.Recipe;
import io.smarthome.core.recipe.RecipeIngredient;
import io.smarthome.core.recipe.RecipeStep;
import io.smarthome.core.recipe.RecipeTag;
import io.smarthome.core.recipe.RecipeTagId;
import io.smarthome.core.recipe.Tag;
import jakarta.enterprise.context.ApplicationScoped;
import org.hibernate.reactive.mutiny.Mutiny.Session;

import java.util.List;

@ApplicationScoped
public class RecipeRepository {

    public static final String HQL_FIND_RECIPE_BY_ID = """
            FROM Recipe WHERE id = :id
            """;

    public static final String HQL_SEARCH_RECIPES = """
            FROM Recipe r
            WHERE (:search IS NULL OR LOWER(r.title) LIKE :search
                OR EXISTS (SELECT 1 FROM RecipeIngredient ri WHERE ri.recipeId = r.id AND LOWER(ri.name) LIKE :search))
            AND (:tagCount = 0 OR (SELECT COUNT(rt) FROM RecipeTag rt WHERE rt.id.recipeId = r.id AND rt.id.tagId IN :tagIds) = :tagCount)
            ORDER BY r.title ASC
            """;

    public static final String HQL_COUNT_SEARCH_RECIPES = """
            SELECT COUNT(r) FROM Recipe r
            WHERE (:search IS NULL OR LOWER(r.title) LIKE :search
                OR EXISTS (SELECT 1 FROM RecipeIngredient ri WHERE ri.recipeId = r.id AND LOWER(ri.name) LIKE :search))
            AND (:tagCount = 0 OR (SELECT COUNT(rt) FROM RecipeTag rt WHERE rt.id.recipeId = r.id AND rt.id.tagId IN :tagIds) = :tagCount)
            """;

    public static final String HQL_FIND_INGREDIENTS_BY_RECIPE = """
            FROM RecipeIngredient WHERE recipeId = :recipeId ORDER BY sortOrder
            """;

    public static final String HQL_FIND_STEPS_BY_RECIPE = """
            FROM RecipeStep WHERE recipeId = :recipeId ORDER BY stepNumber
            """;

    public static final String HQL_FIND_TAGS_BY_RECIPE = """
            FROM Tag t WHERE t.id IN (SELECT rt.id.tagId FROM RecipeTag rt WHERE rt.id.recipeId = :recipeId) ORDER BY t.name
            """;

    public static final String HQL_DELETE_INGREDIENTS_BY_RECIPE = """
            DELETE FROM RecipeIngredient WHERE recipeId = :recipeId
            """;

    public static final String HQL_DELETE_STEPS_BY_RECIPE = """
            DELETE FROM RecipeStep WHERE recipeId = :recipeId
            """;

    public static final String HQL_DELETE_TAG_LINKS_BY_RECIPE = """
            DELETE FROM RecipeTag WHERE id.recipeId = :recipeId
            """;

    public Uni<Recipe> findById(Long id, Session session) {
        return session.createQuery(HQL_FIND_RECIPE_BY_ID, Recipe.class)
                .setParameter("id", id)
                .getSingleResultOrNull();
    }

    public Uni<List<Recipe>> search(String search, List<Long> tagIds, int tagCount, int offset, int limit, Session session) {
        return session.createQuery(HQL_SEARCH_RECIPES, Recipe.class)
                .setParameter("search", search)
                .setParameter("tagIds", nonEmptyOrPlaceholder(tagIds))
                .setParameter("tagCount", tagCount)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    public Uni<Long> countSearch(String search, List<Long> tagIds, int tagCount, Session session) {
        return session.createQuery(HQL_COUNT_SEARCH_RECIPES, Long.class)
                .setParameter("search", search)
                .setParameter("tagIds", nonEmptyOrPlaceholder(tagIds))
                .setParameter("tagCount", tagCount)
                .getSingleResult();
    }

    /**
     * Hibernate rejects binding an empty collection to an IN parameter. When no tags are
     * requested, tagCount = 0 already makes the tag-filter clause true regardless of tagIds'
     * content, so a placeholder value is safe here.
     */
    private static List<Long> nonEmptyOrPlaceholder(List<Long> tagIds) {
        return (tagIds == null || tagIds.isEmpty()) ? List.of(-1L) : tagIds;
    }

    public Uni<Void> save(Recipe recipe, Session session) {
        return session.persist(recipe).replaceWithVoid();
    }

    public Uni<Void> update(Recipe recipe, Session session) {
        return session.merge(recipe).replaceWithVoid();
    }

    public Uni<Void> delete(Recipe recipe, Session session) {
        return session.remove(recipe).replaceWithVoid();
    }

    public Uni<List<RecipeIngredient>> findIngredientsByRecipeId(Long recipeId, Session session) {
        return session.createQuery(HQL_FIND_INGREDIENTS_BY_RECIPE, RecipeIngredient.class)
                .setParameter("recipeId", recipeId)
                .getResultList();
    }

    public Uni<List<RecipeStep>> findStepsByRecipeId(Long recipeId, Session session) {
        return session.createQuery(HQL_FIND_STEPS_BY_RECIPE, RecipeStep.class)
                .setParameter("recipeId", recipeId)
                .getResultList();
    }

    public Uni<List<Tag>> findTagsByRecipeId(Long recipeId, Session session) {
        return session.createQuery(HQL_FIND_TAGS_BY_RECIPE, Tag.class)
                .setParameter("recipeId", recipeId)
                .getResultList();
    }

    public Uni<Void> saveIngredient(RecipeIngredient ingredient, Session session) {
        return session.persist(ingredient).replaceWithVoid();
    }

    public Uni<Void> saveStep(RecipeStep step, Session session) {
        return session.persist(step).replaceWithVoid();
    }

    public Uni<Void> saveTagLink(Long recipeId, Long tagId, Session session) {
        RecipeTag link = RecipeTag.builder()
                .id(RecipeTagId.builder().recipeId(recipeId).tagId(tagId).build())
                .build();
        return session.persist(link).replaceWithVoid();
    }

    public Uni<Integer> deleteIngredientsByRecipeId(Long recipeId, Session session) {
        return session.createMutationQuery(HQL_DELETE_INGREDIENTS_BY_RECIPE)
                .setParameter("recipeId", recipeId)
                .executeUpdate();
    }

    public Uni<Integer> deleteStepsByRecipeId(Long recipeId, Session session) {
        return session.createMutationQuery(HQL_DELETE_STEPS_BY_RECIPE)
                .setParameter("recipeId", recipeId)
                .executeUpdate();
    }

    public Uni<Integer> deleteTagLinksByRecipeId(Long recipeId, Session session) {
        return session.createMutationQuery(HQL_DELETE_TAG_LINKS_BY_RECIPE)
                .setParameter("recipeId", recipeId)
                .executeUpdate();
    }
}
