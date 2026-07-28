package io.smarthome.core.recipe;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@EqualsAndHashCode
public class RecipeTagId implements Serializable {

    @Column(name = "recipe_id")
    public Long recipeId;

    @Column(name = "tag_id")
    public Long tagId;
}
