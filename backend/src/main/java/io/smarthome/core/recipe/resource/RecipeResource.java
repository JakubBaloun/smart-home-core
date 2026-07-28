package io.smarthome.core.recipe.resource;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.common.PageResponse;
import io.smarthome.core.recipe.service.RecipeService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestPath;
import org.jboss.resteasy.reactive.RestQuery;

import java.util.List;

@Path("/api/recipes")
@ApplicationScoped
public class RecipeResource {

    private static final int MIN_SIZE = 1;
    private static final int MAX_SIZE = 100;

    @Inject
    RecipeService recipeService;

    @GET
    public Uni<PageResponse<RecipeListResponse>> searchRecipes(
            @RestQuery String search,
            @RestQuery List<String> tag,
            @RestQuery @DefaultValue("0") int page,
            @RestQuery @DefaultValue("20") int size
    ) {
        int clampedPage = Math.max(page, 0);
        int clampedSize = Math.min(Math.max(size, MIN_SIZE), MAX_SIZE);
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to search recipes (search=%s, tags=%s, page=%d, size=%d)",
                        search, tag, clampedPage, clampedSize))
                .chain(() -> recipeService.searchRecipes(search, tag, clampedPage, clampedSize));
    }

    @GET
    @Path("/{id}")
    public Uni<RecipeDetailResponse> getRecipeById(@RestPath Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to get recipe with id: %d", id))
                .chain(() -> recipeService.getRecipeById(id));
    }

    @POST
    public Uni<RecipeDetailResponse> createRecipe(@Valid RecipeRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to create recipe '%s'", request.title()))
                .chain(() -> recipeService.createRecipe(request));
    }

    @PUT
    @Path("/{id}")
    public Uni<RecipeDetailResponse> updateRecipe(@RestPath Long id, @Valid RecipeRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to update recipe with id: %d", id))
                .chain(() -> recipeService.updateRecipe(id, request));
    }

    @DELETE
    @Path("/{id}")
    public Uni<Void> deleteRecipe(@RestPath Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to delete recipe with id: %d", id))
                .chain(() -> recipeService.deleteRecipe(id));
    }
}
