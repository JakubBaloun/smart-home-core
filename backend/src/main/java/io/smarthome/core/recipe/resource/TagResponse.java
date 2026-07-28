package io.smarthome.core.recipe.resource;

import lombok.Builder;

@Builder
public record TagResponse(
        Long id,
        String name
) {}
