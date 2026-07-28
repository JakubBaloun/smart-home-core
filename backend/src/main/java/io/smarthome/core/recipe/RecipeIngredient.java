package io.smarthome.core.recipe;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "recipe_ingredient")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RecipeIngredient extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "recipe_id", nullable = false)
    public Long recipeId;

    @Column(nullable = false)
    public String name;

    @Column(nullable = false, precision = 10, scale = 2)
    public BigDecimal amount;

    @Enumerated(EnumType.STRING)
    public IngredientUnit unit;

    @Column(name = "sort_order", nullable = false)
    public Integer sortOrder;
}
