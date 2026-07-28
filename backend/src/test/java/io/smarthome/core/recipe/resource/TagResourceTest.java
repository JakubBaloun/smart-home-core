package io.smarthome.core.recipe.resource;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
public class TagResourceTest {

    @Inject
    SessionFactory sessionFactory;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM RecipeTag").executeUpdate()
                        .chain(() -> session.createQuery("DELETE FROM Tag").executeUpdate())
        ).await().indefinitely();
    }

    @Test
    void testListTagsEmpty() {
        given()
                .when().get("/api/tags")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    void testCreateTag() {
        given()
                .contentType("application/json")
                .body("""
                        {"name": "breakfast"}
                        """)
                .when().post("/api/tags")
                .then()
                .statusCode(200)
                .body("name", is("breakfast"));

        given()
                .when().get("/api/tags")
                .then()
                .statusCode(200)
                .body("$", hasSize(1));
    }

    @Test
    void testCreateTag_idempotentNoDuplicateRow() {
        given()
                .contentType("application/json")
                .body("""
                        {"name": "breakfast"}
                        """)
                .when().post("/api/tags")
                .then()
                .statusCode(200);

        given()
                .contentType("application/json")
                .body("""
                        {"name": "breakfast"}
                        """)
                .when().post("/api/tags")
                .then()
                .statusCode(200);

        given()
                .when().get("/api/tags")
                .then()
                .statusCode(200)
                .body("$", hasSize(1));
    }

    @Test
    void testCreateTag_blankNameRejected() {
        given()
                .contentType("application/json")
                .body("""
                        {"name": ""}
                        """)
                .when().post("/api/tags")
                .then()
                .statusCode(400);
    }
}
