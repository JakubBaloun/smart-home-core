package io.smarthome.core.recipe.resource;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record RecipeRequest(
        @NotBlank(message = "title must not be blank")
        String title,

        String description,

        @Positive(message = "servingsBase must be positive")
        Integer servingsBase,

        Integer prepTimeMinutes,

        Integer cookTimeMinutes,

        String notes,

        @NotEmpty(message = "recipe must have at least one ingredient")
        @Valid
        List<IngredientRequest> ingredients,

        @NotEmpty(message = "recipe must have at least one step")
        @Valid
        List<StepRequest> steps,

        List<String> tags
) {}
