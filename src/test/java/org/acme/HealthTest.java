package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
class HealthTest {
    @Test
    void testHealthEndpoint() {
        given()
          .when().get("/q/health")
          .then()
             .statusCode(200);
    }

}