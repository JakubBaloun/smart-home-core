package io.smarthome.core.recipe.resource;

import jakarta.validation.constraints.NotBlank;

public record CreateTagRequest(
        @NotBlank(message = "name must not be blank")
        String name
) {}
