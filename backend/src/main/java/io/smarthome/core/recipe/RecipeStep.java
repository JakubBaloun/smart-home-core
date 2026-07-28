package io.smarthome.core.recipe;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "recipe_step")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RecipeStep extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "recipe_id", nullable = false)
    public Long recipeId;

    @Column(name = "step_number", nullable = false)
    public Integer stepNumber;

    public String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String content;

    @Column(name = "timer_seconds")
    public Integer timerSeconds;
}
