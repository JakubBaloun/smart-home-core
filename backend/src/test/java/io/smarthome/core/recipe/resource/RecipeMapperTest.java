package io.smarthome.core.recipe.resource;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.recipe.IngredientUnit;
import io.smarthome.core.recipe.Recipe;
import io.smarthome.core.recipe.RecipeIngredient;
import io.smarthome.core.recipe.RecipeStep;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class RecipeMapperTest {

    @Inject
    RecipeMapper recipeMapper;

    @Test
    void testToEntity_ignoresServerAssignedFields() {
        // GIVEN
        RecipeRequest request = new RecipeRequest(
                "Pancakes",
                "Fluffy pancakes",
                4,
                10,
                15,
                "Serve warm",
                List.of(new IngredientRequest("Flour", BigDecimal.TEN, IngredientUnit.G)),
                List.of(new StepRequest("Mix", "Mix everything", null)),
                List.of("breakfast")
        );

        // WHEN
        Recipe recipe = recipeMapper.toEntity(request);

        // THEN
        assertNull(recipe.getId());
        assertNotNull(recipe.getCreatedAt(), "CreatedAt should be set by builder default");
        assertNotNull(recipe.getUpdatedAt(), "UpdatedAt should be set by builder default");
        assertEquals("Pancakes", recipe.getTitle());
        assertEquals("Fluffy pancakes", recipe.getDescription());
        assertEquals(4, recipe.getServingsBase());
        assertEquals(10, recipe.getPrepTimeMinutes());
        assertEquals(15, recipe.getCookTimeMinutes());
        assertEquals("Serve warm", recipe.getNotes());
    }

    @Test
    void testToIngredientEntity_ignoresServerAssignedFields() {
        // GIVEN
        IngredientRequest request = new IngredientRequest("Sugar", BigDecimal.ONE, IngredientUnit.TSP);

        // WHEN
        RecipeIngredient ingredient = recipeMapper.toIngredientEntity(request);

        // THEN
        assertNull(ingredient.getId());
        assertNull(ingredient.getRecipeId());
        assertNull(ingredient.getSortOrder());
        assertEquals("Sugar", ingredient.getName());
        assertEquals(BigDecimal.ONE, ingredient.getAmount());
        assertEquals(IngredientUnit.TSP, ingredient.getUnit());
    }

    @Test
    void testToStepEntity_ignoresServerAssignedFields() {
        // GIVEN
        StepRequest request = new StepRequest("Bake", "Bake at 200C", 600);

        // WHEN
        RecipeStep step = recipeMapper.toStepEntity(request);

        // THEN
        assertNull(step.getId());
        assertNull(step.getRecipeId());
        assertNull(step.getStepNumber());
        assertEquals("Bake", step.getTitle());
        assertEquals("Bake at 200C", step.getContent());
        assertEquals(600, step.getTimerSeconds());
    }

    @Test
    void testToListResponse_assemblesFromRecipeAndTags() {
        // GIVEN
        Recipe recipe = Recipe.builder()
                .id(1L)
                .title("Pancakes")
                .servingsBase(4)
                .prepTimeMinutes(10)
                .cookTimeMinutes(15)
                .build();
        List<TagResponse> tags = List.of(TagResponse.builder().id(1L).name("breakfast").build());

        // WHEN
        RecipeListResponse response = recipeMapper.toListResponse(recipe, tags);

        // THEN
        assertEquals(1L, response.id());
        assertEquals("Pancakes", response.title());
        assertEquals(4, response.servingsBase());
        assertEquals(10, response.prepTimeMinutes());
        assertEquals(15, response.cookTimeMinutes());
        assertEquals(tags, response.tags());
    }

    @Test
    void testToDetailResponse_assemblesFromAllSources() {
        // GIVEN
        OffsetDateTime now = OffsetDateTime.now();
        Recipe recipe = Recipe.builder()
                .id(1L)
                .title("Pancakes")
                .description("Fluffy pancakes")
                .servingsBase(4)
                .prepTimeMinutes(10)
                .cookTimeMinutes(15)
                .notes("Serve warm")
                .createdAt(now)
                .updatedAt(now)
                .build();
        List<RecipeIngredientResponse> ingredients = List.of(
                RecipeIngredientResponse.builder().id(1L).name("Flour").amount(BigDecimal.TEN).unit(IngredientUnit.G).sortOrder(0).build()
        );
        List<RecipeStepResponse> steps = List.of(
                RecipeStepResponse.builder().id(1L).stepNumber(1).content("Mix everything").build()
        );
        List<TagResponse> tags = List.of(TagResponse.builder().id(1L).name("breakfast").build());

        // WHEN
        RecipeDetailResponse response = recipeMapper.toDetailResponse(recipe, ingredients, steps, tags);

        // THEN
        assertEquals(1L, response.id());
        assertEquals("Pancakes", response.title());
        assertEquals("Fluffy pancakes", response.description());
        assertEquals(4, response.servingsBase());
        assertEquals(10, response.prepTimeMinutes());
        assertEquals(15, response.cookTimeMinutes());
        assertEquals("Serve warm", response.notes());
        assertEquals(ingredients, response.ingredients());
        assertEquals(steps, response.steps());
        assertEquals(tags, response.tags());
        assertEquals(now, response.createdAt());
        assertEquals(now, response.updatedAt());
    }
}
