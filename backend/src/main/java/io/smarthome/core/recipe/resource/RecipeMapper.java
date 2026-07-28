package io.smarthome.core.recipe.resource;

import io.smarthome.core.recipe.Recipe;
import io.smarthome.core.recipe.RecipeIngredient;
import io.smarthome.core.recipe.RecipeStep;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "jakarta-cdi")
public interface RecipeMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Recipe toEntity(RecipeRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recipeId", ignore = true)
    @Mapping(target = "sortOrder", ignore = true)
    RecipeIngredient toIngredientEntity(IngredientRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recipeId", ignore = true)
    @Mapping(target = "stepNumber", ignore = true)
    RecipeStep toStepEntity(StepRequest request);

    RecipeIngredientResponse toIngredientResponse(RecipeIngredient ingredient);

    List<RecipeIngredientResponse> toIngredientResponseList(List<RecipeIngredient> ingredients);

    RecipeStepResponse toStepResponse(RecipeStep step);

    List<RecipeStepResponse> toStepResponseList(List<RecipeStep> steps);

    RecipeListResponse toListResponse(Recipe recipe, List<TagResponse> tags);

    RecipeDetailResponse toDetailResponse(
            Recipe recipe,
            List<RecipeIngredientResponse> ingredients,
            List<RecipeStepResponse> steps,
            List<TagResponse> tags
    );
}
