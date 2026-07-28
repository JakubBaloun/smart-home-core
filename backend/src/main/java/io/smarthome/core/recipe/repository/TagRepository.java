package io.smarthome.core.recipe.repository;

import io.smallrye.mutiny.Uni;
import io.smarthome.core.recipe.Tag;
import jakarta.enterprise.context.ApplicationScoped;
import org.hibernate.reactive.mutiny.Mutiny.Session;

import java.util.List;

@ApplicationScoped
public class TagRepository {

    public static final String HQL_LIST_TAGS = """
            FROM Tag ORDER BY name
            """;

    public static final String HQL_FIND_TAG_BY_NAME = """
            FROM Tag WHERE name = :name
            """;

    public static final String HQL_FIND_TAG_IDS_BY_NAMES = """
            SELECT id FROM Tag WHERE name IN :names
            """;

    public Uni<List<Tag>> listAll(Session session) {
        return session.createQuery(HQL_LIST_TAGS, Tag.class).getResultList();
    }

    public Uni<Tag> findByName(String name, Session session) {
        return session.createQuery(HQL_FIND_TAG_BY_NAME, Tag.class)
                .setParameter("name", name)
                .getSingleResultOrNull();
    }

    public Uni<List<Long>> findIdsByNames(List<String> names, Session session) {
        if (names == null || names.isEmpty()) {
            return Uni.createFrom().item(List.of());
        }
        return session.createQuery(HQL_FIND_TAG_IDS_BY_NAMES, Long.class)
                .setParameter("names", names)
                .getResultList();
    }

    public Uni<Void> save(Tag tag, Session session) {
        return session.persist(tag).replaceWithVoid();
    }
}
