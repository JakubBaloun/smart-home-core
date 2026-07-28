package io.smarthome.core.recipe.service;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.common.PageResponse;
import io.smarthome.core.common.exception.ResourceNotFoundException;
import io.smarthome.core.recipe.IngredientUnit;
import io.smarthome.core.recipe.Tag;
import io.smarthome.core.recipe.resource.IngredientRequest;
import io.smarthome.core.recipe.resource.RecipeDetailResponse;
import io.smarthome.core.recipe.resource.RecipeListResponse;
import io.smarthome.core.recipe.resource.RecipeRequest;
import io.smarthome.core.recipe.resource.StepRequest;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class RecipeServiceTest {

    @Inject
    RecipeService recipeService;

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

    private RecipeRequest newRequest(String title, Integer servingsBase, List<String> tags) {
        return new RecipeRequest(
                title,
                "description",
                servingsBase,
                10,
                20,
                "notes",
                List.of(
                        new IngredientRequest("Flour", BigDecimal.TEN, IngredientUnit.G),
                        new IngredientRequest("Sugar", BigDecimal.ONE, IngredientUnit.TSP)
                ),
                List.of(
                        new StepRequest("Mix", "Mix everything", null),
                        new StepRequest("Bake", "Bake at 200C", 600)
                ),
                tags
        );
    }

    @Test
    void testCreateRecipe_defaultsServingsBaseWhenNull() {
        // WHEN
        RecipeDetailResponse response = recipeService.createRecipe(newRequest("Pancakes", null, List.of())).await().indefinitely();

        // THEN
        assertEquals(4, response.servingsBase());
    }

    @Test
    void testCreateRecipe_derivesSortOrderAndStepNumberFromArrayIndex() {
        // WHEN
        RecipeDetailResponse response = recipeService.createRecipe(newRequest("Pancakes", 2, List.of())).await().indefinitely();

        // THEN
        assertEquals(0, response.ingredients().get(0).sortOrder());
        assertEquals(1, response.ingredients().get(1).sortOrder());
        assertEquals(1, response.steps().get(0).stepNumber());
        assertEquals(2, response.steps().get(1).stepNumber());
    }

    @Test
    void testCreateRecipe_reusesExistingTagAcrossRecipes() {
        // WHEN
        recipeService.createRecipe(newRequest("Pancakes", 4, List.of("breakfast", "sweet"))).await().indefinitely();
        recipeService.createRecipe(newRequest("Waffles", 4, List.of("breakfast"))).await().indefinitely();

        // THEN
        List<Tag> tags = sessionFactory.withSession(session ->
                session.createQuery("FROM Tag", Tag.class).getResultList()
        ).await().indefinitely();
        assertEquals(2, tags.size(), "The 'breakfast' tag should be reused, not duplicated");
    }

    @Test
    void testUpdateRecipe_fullyReplacesChildren() {
        // GIVEN
        RecipeDetailResponse created = recipeService.createRecipe(newRequest("Pancakes", 4, List.of("breakfast"))).await().indefinitely();
        RecipeRequest updateRequest = new RecipeRequest(
                "Pancakes v2",
                "new description",
                6,
                5,
                10,
                "new notes",
                List.of(new IngredientRequest("Milk", BigDecimal.ONE, IngredientUnit.L)),
                List.of(new StepRequest(null, "Just mix", null)),
                List.of("dinner")
        );

        // WHEN
        RecipeDetailResponse updated = recipeService.updateRecipe(created.id(), updateRequest).await().indefinitely();

        // THEN
        assertEquals("Pancakes v2", updated.title());
        assertEquals(6, updated.servingsBase());
        assertEquals(1, updated.ingredients().size());
        assertEquals("Milk", updated.ingredients().get(0).name());
        assertEquals(1, updated.steps().size());
        assertEquals("Just mix", updated.steps().get(0).content());
        assertEquals(1, updated.tags().size());
        assertEquals("dinner", updated.tags().get(0).name());
    }

    @Test
    void testDeleteRecipe_unknownIdThrowsNotFound() {
        assertThrows(ResourceNotFoundException.class, () ->
                recipeService.deleteRecipe(999999L).await().indefinitely());
    }

    @Test
    void testGetRecipeById_unknownIdThrowsNotFound() {
        assertThrows(ResourceNotFoundException.class, () ->
                recipeService.getRecipeById(999999L).await().indefinitely());
    }

    @Test
    void testSearchRecipes_paginationAndTotals() {
        // GIVEN
        recipeService.createRecipe(newRequest("Alpha", 4, List.of())).await().indefinitely();
        recipeService.createRecipe(newRequest("Beta", 4, List.of())).await().indefinitely();
        recipeService.createRecipe(newRequest("Gamma", 4, List.of())).await().indefinitely();

        // WHEN
        PageResponse<RecipeListResponse> page = recipeService.searchRecipes(null, List.of(), 0, 2).await().indefinitely();

        // THEN
        assertEquals(2, page.items().size());
        assertEquals(3, page.totalElements());
        assertEquals(2, page.totalPages());
    }
}
