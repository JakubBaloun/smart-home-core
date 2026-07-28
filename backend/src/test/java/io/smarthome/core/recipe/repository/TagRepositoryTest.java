package io.smarthome.core.recipe.repository;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.recipe.Tag;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class TagRepositoryTest {

    @Inject
    TagRepository tagRepository;

    @Inject
    SessionFactory sessionFactory;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM Tag").executeUpdate()
        ).await().indefinitely();
    }

    private Long saveTag(String name) {
        Tag tag = Tag.builder().name(name).build();
        sessionFactory.withTransaction(session -> tagRepository.save(tag, session)).await().indefinitely();
        return tag.getId();
    }

    @Test
    void testSaveAndFindByName() {
        saveTag("vegan");

        Tag found = sessionFactory.withSession(session -> tagRepository.findByName("vegan", session)).await().indefinitely();

        assertNotNull(found, "Tag should be found by name");
        assertEquals("vegan", found.getName());
    }

    @Test
    void testFindIdsByNamesWithMixOfExistingAndNonexistent() {
        Long veganId = saveTag("vegan");
        saveTag("quick");

        List<Long> ids = sessionFactory.withSession(session ->
                tagRepository.findIdsByNames(List.of("vegan", "does-not-exist"), session)
        ).await().indefinitely();

        assertEquals(1, ids.size());
        assertEquals(veganId, ids.get(0));
    }
}
