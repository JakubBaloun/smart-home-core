package io.smarthome.core.device.resource;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.repository.DeviceRepository;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
public class DeviceResourceTest {

    @Inject
    SessionFactory sessionFactory;

    @Inject
    DeviceRepository deviceRepository;

    private Long seededDeviceId;

    @BeforeEach
    void seed() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM Device").executeUpdate()
        ).await().indefinitely();

        Device device = Device.builder()
                .ieeeAddress("00:11:22:33:44:55")
                .friendlyName("Living Room Sensor")
                .type(DeviceType.SENSOR)
                .vendor("Aqara")
                .model("WSDCGQ11LM")
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        seededDeviceId = device.getId();
    }

    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM Device").executeUpdate()
        ).await().indefinitely();
    }

    @Test
    void testListDevices() {
        given()
            .when().get("/api/devices")
            .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("[0].ieeeAddress", is("00:11:22:33:44:55"))
                .body("[0].friendlyName", is("Living Room Sensor"))
                .body("[0].type", is("SENSOR"));
    }

    @Test
    void testGetDeviceById() {
        given()
            .when().get("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(200)
                .body("id", is(seededDeviceId.intValue()))
                .body("ieeeAddress", is("00:11:22:33:44:55"))
                .body("friendlyName", is("Living Room Sensor"))
                .body("type", is("SENSOR"))
                .body("vendor", is("Aqara"))
                .body("model", is("WSDCGQ11LM"))
                .body("available", is(true))
                .body("createdAt", notNullValue())
                .body("updatedAt", notNullValue());
    }

    @Test
    void testGetDeviceNotFound() {
        given()
            .when().get("/api/devices/{id}", 999999)
            .then()
                .statusCode(404)
                .body("title", is("Not Found"))
                .body("detail", is("Device with id '999999' not found"))
                .body("status", is(404));
    }

    @Test
    void testUpdateFriendlyName() {
        given()
            .contentType("application/json")
            .body("""
                {"friendlyName": "Kitchen Sensor"}
                """)
            .when().put("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(204);

        given()
            .when().get("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(200)
                .body("friendlyName", is("Kitchen Sensor"));
    }

    @Test
    void testUpdateType() {
        given()
            .contentType("application/json")
            .body("""
                {"friendlyName": "Living Room Sensor", "type": "LIGHT"}
                """)
            .when().put("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(204);

        given()
            .when().get("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(200)
                .body("type", is("LIGHT"));
    }

    @Test
    void testUpdateDeviceNotFound() {
        given()
            .contentType("application/json")
            .body("""
                {"friendlyName": "New Name"}
                """)
            .when().put("/api/devices/{id}", 999999)
            .then()
                .statusCode(404)
                .body("title", is("Not Found"));
    }

    @Test
    void testUpdateBlankFriendlyName() {
        given()
            .contentType("application/json")
            .body("""
                {"friendlyName": ""}
                """)
            .when().put("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(400);
    }

    @Test
    void testDeleteDevice() {
        given()
            .when().delete("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(204);

        given()
            .when().get("/api/devices/{id}", seededDeviceId)
            .then()
                .statusCode(404);
    }

    @Test
    void testDeleteDeviceNotFound() {
        given()
            .when().delete("/api/devices/{id}", 999999)
            .then()
                .statusCode(404)
                .body("title", is("Not Found"));
    }
}
