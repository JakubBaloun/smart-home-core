package io.smarthome.core.recipe.resource;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
public class RecipeResourceTest {

    @Inject
    SessionFactory sessionFactory;

    private static final String VALID_RECIPE_BODY = """
            {
                "title": "Pancakes",
                "description": "Fluffy pancakes",
                "servingsBase": 4,
                "prepTimeMinutes": 10,
                "cookTimeMinutes": 15,
                "notes": "Serve warm",
                "ingredients": [
                    {"name": "Flour", "amount": 200, "unit": "G"},
                    {"name": "Milk", "amount": 300, "unit": "ML"}
                ],
                "steps": [
                    {"title": "Mix", "content": "Mix everything", "timerSeconds": null},
                    {"title": "Bake", "content": "Bake at 200C", "timerSeconds": 600}
                ],
                "tags": ["breakfast", "sweet"]
            }
            """;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM RecipeTag").executeUpdate()
                        .chain(() -> session.createQuery("DELETE FROM RecipeIngredient").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM RecipeStep").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM Recipe").executeUpdate())
                        .chain(() -> session.createQuery("DELETE FROM Tag").executeUpdate())
        ).await().indefinitely();
    }

    private int createRecipe(String body) {
        return given()
                .contentType("application/json")
                .body(body)
                .when().post("/api/recipes")
                .then()
                .statusCode(200)
                .extract().path("id");
    }

    @Test
    void testCreateAndGetRecipe() {
        int id = createRecipe(VALID_RECIPE_BODY);

        given()
                .when().get("/api/recipes/{id}", id)
                .then()
                .statusCode(200)
                .body("title", is("Pancakes"))
                .body("servingsBase", is(4))
                .body("ingredients", hasSize(2))
                .body("steps", hasSize(2))
                .body("steps[0].stepNumber", is(1))
                .body("steps[1].stepNumber", is(2))
                .body("tags", hasSize(2))
                .body("createdAt", notNullValue())
                .body("updatedAt", notNullValue());
    }

    @Test
    void testGetRecipeNotFound() {
        given()
                .when().get("/api/recipes/{id}", 999999)
                .then()
                .statusCode(404)
                .body("title", is("Not Found"))
                .body("detail", is("Recipe with id '999999' not found"));
    }

    @Test
    void testCreateRecipe_emptyIngredientsRejected() {
        given()
                .contentType("application/json")
                .body("""
                        {
                            "title": "No Ingredients",
                            "ingredients": [],
                            "steps": [{"content": "Mix"}]
                        }
                        """)
                .when().post("/api/recipes")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateRecipe_emptyStepsRejected() {
        given()
                .contentType("application/json")
                .body("""
                        {
                            "title": "No Steps",
                            "ingredients": [{"name": "Flour", "amount": 100}],
                            "steps": []
                        }
                        """)
                .when().post("/api/recipes")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateRecipe_blankTitleRejected() {
        given()
                .contentType("application/json")
                .body("""
                        {
                            "title": "",
                            "ingredients": [{"name": "Flour", "amount": 100}],
                            "steps": [{"content": "Mix"}]
                        }
                        """)
                .when().post("/api/recipes")
                .then()
                .statusCode(400);
    }

    @Test
    void testCreateRecipe_negativeTimerSecondsRejected() {
        given()
                .contentType("application/json")
                .body("""
                        {
                            "title": "Bad Timer",
                            "ingredients": [{"name": "Flour", "amount": 100}],
                            "steps": [{"content": "Mix", "timerSeconds": -5}]
                        }
                        """)
                .when().post("/api/recipes")
                .then()
                .statusCode(400);
    }

    @Test
    void testUpdateRecipe() {
        int id = createRecipe(VALID_RECIPE_BODY);

        given()
                .contentType("application/json")
                .body("""
                        {
                            "title": "Pancakes v2",
                            "ingredients": [{"name": "Egg", "amount": 2}],
                            "steps": [{"content": "Whisk"}]
                        }
                        """)
                .when().put("/api/recipes/{id}", id)
                .then()
                .statusCode(200)
                .body("title", is("Pancakes v2"))
                .body("ingredients", hasSize(1))
                .body("steps", hasSize(1));
    }

    @Test
    void testUpdateRecipeNotFound() {
        given()
                .contentType("application/json")
                .body(VALID_RECIPE_BODY)
                .when().put("/api/recipes/{id}", 999999)
                .then()
                .statusCode(404);
    }

    @Test
    void testDeleteRecipe() {
        int id = createRecipe(VALID_RECIPE_BODY);

        given()
                .when().delete("/api/recipes/{id}", id)
                .then()
                .statusCode(204);

        given()
                .when().get("/api/recipes/{id}", id)
                .then()
                .statusCode(404);
    }

    @Test
    void testDeleteRecipeNotFound() {
        given()
                .when().delete("/api/recipes/{id}", 999999)
                .then()
                .statusCode(404);
    }

    @Test
    void testSearchRecipes_paginationReflectedInResponse() {
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Alpha\""));
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Beta\""));

        given()
                .queryParam("page", 0)
                .queryParam("size", 1)
                .when().get("/api/recipes")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("page", is(0))
                .body("size", is(1))
                .body("totalElements", is(2))
                .body("totalPages", is(2));
    }

    @Test
    void testSearchRecipes_repeatedTagParamAndFilters() {
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Alpha\""));
        createRecipe(VALID_RECIPE_BODY
                .replace("\"Pancakes\"", "\"Beta\"")
                .replace("[\"breakfast\", \"sweet\"]", "[\"breakfast\"]"));

        given()
                .queryParam("tag", "breakfast", "sweet")
                .when().get("/api/recipes")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].title", is("Alpha"))
                .body("totalElements", is(1));
    }

    @Test
    void testSearchRecipes_byIngredientName() {
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Alpha\""));

        given()
                .queryParam("search", "flour")
                .when().get("/api/recipes")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("totalElements", greaterThanOrEqualTo(1));
    }

    @Test
    void testTagReuseVisibleViaGetTags() {
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Alpha\""));
        createRecipe(VALID_RECIPE_BODY.replace("\"Pancakes\"", "\"Beta\""));

        given()
                .when().get("/api/tags")
                .then()
                .statusCode(200)
                .body("$", hasSize(2));
    }
}
