package io.smarthome.core.telemetry.resource;

import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.telemetry.service.TelemetryService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@QuarkusTest
public class TelemetryResourceTest {

    @InjectMock
    TelemetryService telemetryService;

    private static final String FROM = "2026-01-01T00:00:00Z";
    private static final String TO = "2026-01-02T00:00:00Z";

    @Test
    void testGetHistory_returnsPoints() {
        // GIVEN
        FluxRecord record = mockRecord(Instant.parse("2026-01-01T10:00:00Z"), 22.5);
        FluxTable table = mockTable(List.of(record));

        when(telemetryService.queryTelemetry(anyString(), anyString(), anyString(), any(), any()))
                .thenReturn(Uni.createFrom().item(List.of(table)));

        // WHEN / THEN
        given()
                .queryParam("field", "temperature")
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(200)
                .body("deviceName", is("sensor-1"))
                .body("field", is("temperature"))
                .body("points", hasSize(1))
                .body("points[0].value", is(22.5f));
    }

    @Test
    void testGetHistory_withAggregation_returnsPoints() {
        // GIVEN
        FluxRecord record = mockRecord(Instant.parse("2026-01-01T10:00:00Z"), 21.0);
        FluxTable table = mockTable(List.of(record));

        when(telemetryService.queryTelemetryAggregated(anyString(), anyString(), anyString(), any(), any(), eq("mean"), eq("5m")))
                .thenReturn(Uni.createFrom().item(List.of(table)));

        // WHEN / THEN
        given()
                .queryParam("field", "temperature")
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .queryParam("aggregate", "mean")
                .queryParam("window", "5m")
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(200)
                .body("points", hasSize(1))
                .body("points[0].value", is(21.0f));
    }

    @Test
    void testGetLatest_returnsValues() {
        // GIVEN
        FluxRecord tempRecord = mockRecord(Instant.parse("2026-01-01T12:00:00Z"), 22.5, "temperature");
        FluxRecord humRecord = mockRecord(Instant.parse("2026-01-01T12:00:00Z"), 60.0, "humidity");
        FluxTable table = mockTable(List.of(tempRecord, humRecord));

        when(telemetryService.queryLatest(anyString()))
                .thenReturn(Uni.createFrom().item(List.of(table)));

        // WHEN / THEN
        given()
                .when().get("/api/telemetry/sensor-1/latest")
                .then()
                .statusCode(200)
                .body("deviceName", is("sensor-1"))
                .body("values.temperature", is(22.5f))
                .body("values.humidity", is(60.0f))
                .body("lastUpdated", notNullValue());
    }

    @Test
    void testGetHistory_missingField_returns400() {
        given()
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("title", is("Bad Request"))
                .body("detail", containsString("field"));
    }

    @Test
    void testGetHistory_unknownField_returns400() {
        given()
                .queryParam("field", "unknown_sensor_field")
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("field"));
    }

    @Test
    void testGetHistory_missingFrom_returns400() {
        given()
                .queryParam("field", "temperature")
                .queryParam("to", TO)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("from"));
    }

    @Test
    void testGetHistory_invalidTimestamp_returns400() {
        given()
                .queryParam("field", "temperature")
                .queryParam("from", "not-a-date")
                .queryParam("to", TO)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("ISO-8601"));
    }

    @Test
    void testGetHistory_fromAfterTo_returns400() {
        given()
                .queryParam("field", "temperature")
                .queryParam("from", TO)
                .queryParam("to", FROM)
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("before"));
    }

    @Test
    void testGetHistory_aggregateWithoutWindow_returns400() {
        given()
                .queryParam("field", "temperature")
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .queryParam("aggregate", "mean")
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("window"));
    }

    @Test
    void testGetHistory_invalidAggregate_returns400() {
        given()
                .queryParam("field", "temperature")
                .queryParam("from", FROM)
                .queryParam("to", TO)
                .queryParam("aggregate", "sum")
                .queryParam("window", "5m")
                .when().get("/api/telemetry/sensor-1")
                .then()
                .statusCode(400)
                .body("detail", containsString("aggregate"));
    }

    // --- helpers ---

    private FluxRecord mockRecord(Instant time, double value) {
        return mockRecord(time, value, "value");
    }

    private FluxRecord mockRecord(Instant time, double value, String field) {
        FluxRecord record = mock(FluxRecord.class);
        when(record.getTime()).thenReturn(time);
        when(record.getValue()).thenReturn(value);
        when(record.getField()).thenReturn(field);
        return record;
    }

    private FluxTable mockTable(List<FluxRecord> records) {
        FluxTable table = mock(FluxTable.class);
        when(table.getRecords()).thenReturn(records);
        return table;
    }
}
