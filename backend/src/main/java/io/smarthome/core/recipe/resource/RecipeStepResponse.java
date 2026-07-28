package io.smarthome.core.recipe.resource;

import lombok.Builder;

@Builder
public record RecipeStepResponse(
        Long id,
        Integer stepNumber,
        String title,
        String content,
        Integer timerSeconds
) {}
