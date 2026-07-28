package io.smarthome.core.recipe.resource;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.recipe.service.TagService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;

import java.util.List;

@Path("/api/tags")
@ApplicationScoped
public class TagResource {

    @Inject
    TagService tagService;

    @Inject
    TagMapper tagMapper;

    @GET
    public Uni<List<TagResponse>> getAllTags() {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to get all tags"))
                .chain(() -> tagService.getAllTags())
                .map(tagMapper::toResponseList);
    }

    @POST
    public Uni<TagResponse> createTag(@Valid CreateTagRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to create tag '%s'", request.name()))
                .chain(() -> tagService.createTag(request.name()))
                .map(tagMapper::toResponse);
    }
}
