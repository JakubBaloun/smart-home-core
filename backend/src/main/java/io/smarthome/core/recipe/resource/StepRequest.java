package io.smarthome.core.recipe.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record StepRequest(
        String title,

        @NotBlank(message = "content must not be blank")
        String content,

        @Positive(message = "timerSeconds must be positive when present")
        Integer timerSeconds
) {}
