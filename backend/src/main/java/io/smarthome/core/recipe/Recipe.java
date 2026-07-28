package io.smarthome.core.recipe;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "recipe")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Recipe extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String title;

    @Column(columnDefinition = "TEXT")
    public String description;

    @Column(name = "servings_base", nullable = false)
    @Builder.Default
    public Integer servingsBase = 4;

    @Column(name = "prep_time_minutes")
    public Integer prepTimeMinutes;

    @Column(name = "cook_time_minutes")
    public Integer cookTimeMinutes;

    @Column(columnDefinition = "TEXT")
    public String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    public OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    public OffsetDateTime updatedAt = OffsetDateTime.now();
}
