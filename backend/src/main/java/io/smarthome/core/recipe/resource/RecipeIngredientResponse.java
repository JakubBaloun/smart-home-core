package io.smarthome.core.recipe.resource;

import io.smarthome.core.recipe.IngredientUnit;
import lombok.Builder;

import java.math.BigDecimal;

@Builder
public record RecipeIngredientResponse(
        Long id,
        String name,
        BigDecimal amount,
        IngredientUnit unit,
        Integer sortOrder
) {}
