package io.smarthome.core.recipe.resource;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.List;

@Builder
public record RecipeDetailResponse(
        Long id,
        String title,
        String description,
        Integer servingsBase,
        Integer prepTimeMinutes,
        Integer cookTimeMinutes,
        String notes,
        List<RecipeIngredientResponse> ingredients,
        List<RecipeStepResponse> steps,
        List<TagResponse> tags,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
