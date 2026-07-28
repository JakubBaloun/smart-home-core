package io.smarthome.core.recipe.service;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.recipe.Tag;
import io.smarthome.core.recipe.repository.TagRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.Session;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;

import java.util.List;

@ApplicationScoped
public class TagService {

    @Inject
    SessionFactory sessionFactory;

    @Inject
    TagRepository tagRepository;

    public Uni<List<Tag>> getAllTags() {
        return sessionFactory.withSession(session -> tagRepository.listAll(session))
                .invoke(tags -> Log.debugf("Retrieved %d tags from the database", tags.size()))
                .onFailure().invoke(e -> Log.errorf("Failed to retrieve tags from the database: %s", e.getMessage()));
    }

    public Uni<Tag> createTag(String name) {
        return sessionFactory.withTransaction(session -> findOrCreate(name, session))
                .invoke(tag -> Log.infof("Tag '%s' available with id %d", tag.getName(), tag.getId()))
                .onFailure().invoke(e -> Log.errorf("Failed to create tag '%s': %s", name, e.getMessage()));
    }

    /**
     * Session-scoped get-or-create: takes an existing session rather than opening its own
     * transaction, so callers (e.g. RecipeService) can invoke this inside their own
     * transaction without nesting transactions.
     */
    public Uni<Tag> findOrCreate(String name, Session session) {
        return tagRepository.findByName(name, session)
                .chain(existing -> {
                    if (existing != null) {
                        return Uni.createFrom().item(existing);
                    }
                    Tag tag = Tag.builder().name(name).build();
                    return tagRepository.save(tag, session).replaceWith(tag);
                });
    }
}
