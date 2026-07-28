package io.smarthome.core.recipe.resource;

import lombok.Builder;

import java.util.List;

@Builder
public record RecipeListResponse(
        Long id,
        String title,
        Integer servingsBase,
        Integer prepTimeMinutes,
        Integer cookTimeMinutes,
        List<TagResponse> tags
) {}
