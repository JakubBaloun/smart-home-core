package io.smarthome.core.recipe;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "recipe_tag")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RecipeTag extends PanacheEntityBase {

    @EmbeddedId
    public RecipeTagId id;
}
