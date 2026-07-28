package io.smarthome.core.recipe.resource;

import io.smarthome.core.recipe.IngredientUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record IngredientRequest(
        @NotBlank(message = "name must not be blank")
        String name,

        @NotNull(message = "amount must not be null")
        @Positive(message = "amount must be positive")
        BigDecimal amount,

        IngredientUnit unit
) {}
