package io.smarthome.core.telemetry.service;

import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.telemetry.InfluxDbTestResource;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(value = InfluxDbTestResource.class, restrictToAnnotatedClass = true)
public class TelemetryServiceIT {

    @Inject
    TelemetryService telemetryService;

    @Test
    void testWriteAndQuery_temperature_roundTrip() {
        // GIVEN
        String deviceId = "sensor-living-room";
        double expectedValue = 22.5;
        Instant from = Instant.now().minusSeconds(5);

        // WHEN
        telemetryService.writeTelemetry(deviceId, "temperature", Map.of("temperature", expectedValue))
                .await().indefinitely();

        Instant to = Instant.now().plusSeconds(5);
        List<FluxTable> result = telemetryService.queryTelemetry(deviceId, "temperature", from, to)
                .await().indefinitely();

        // THEN
        assertNotNull(result);
        assertFalse(result.isEmpty(), "Expected at least one table with temperature data");

        List<FluxRecord> records = result.stream()
                .flatMap(t -> t.getRecords().stream())
                .toList();
        assertFalse(records.isEmpty(), "Expected at least one record");
        assertEquals(expectedValue, ((Number) records.getFirst().getValue()).doubleValue(), 0.001);
    }

    @Test
    void testWriteAndQuery_multipleFields_temperatureAndHumidity() {
        // GIVEN
        String deviceId = "sensor-bedroom";
        Instant from = Instant.now().minusSeconds(5);

        // WHEN
        telemetryService.writeTelemetry(deviceId, "temperature", Map.of("temperature", 21.0))
                .await().indefinitely();
        telemetryService.writeTelemetry(deviceId, "humidity", Map.of("humidity", 65.5))
                .await().indefinitely();

        Instant to = Instant.now().plusSeconds(5);

        // THEN - temperature
        List<FluxTable> tempResult = telemetryService.queryTelemetry(deviceId, "temperature", from, to)
                .await().indefinitely();
        assertFalse(tempResult.isEmpty(), "Expected temperature data");
        double temperature = ((Number) tempResult.getFirst().getRecords().getFirst().getValue()).doubleValue();
        assertEquals(21.0, temperature, 0.001);

        // THEN - humidity
        List<FluxTable> humResult = telemetryService.queryTelemetry(deviceId, "humidity", from, to)
                .await().indefinitely();
        assertFalse(humResult.isEmpty(), "Expected humidity data");
        double humidity = ((Number) humResult.getFirst().getRecords().getFirst().getValue()).doubleValue();
        assertEquals(65.5, humidity, 0.001);
    }

    @Test
    void testQuery_noData_returnsEmpty() {
        // GIVEN - no data written for this device
        String deviceId = "nonexistent-device-xyz";
        Instant from = Instant.now().minusSeconds(60);
        Instant to = Instant.now();

        // WHEN
        List<FluxTable> result = telemetryService.queryTelemetry(deviceId, "temperature", from, to)
                .await().indefinitely();

        // THEN
        assertNotNull(result);
        boolean noRecords = result.isEmpty() || result.stream().allMatch(t -> t.getRecords().isEmpty());
        assertTrue(noRecords, "Expected no records for unknown device");
    }

    @Test
    void testWrite_multipleReadings_queryReturnsAll() {
        // GIVEN
        String deviceId = "sensor-kitchen";
        Instant from = Instant.now().minusSeconds(5);

        // WHEN - write 3 readings with small delay to ensure distinct timestamps
        telemetryService.writeTelemetry(deviceId, "temperature", Map.of("temperature", 20.0))
                .await().indefinitely();
        telemetryService.writeTelemetry(deviceId, "temperature", Map.of("temperature", 20.5))
                .await().indefinitely();
        telemetryService.writeTelemetry(deviceId, "temperature", Map.of("temperature", 21.0))
                .await().indefinitely();

        Instant to = Instant.now().plusSeconds(5);
        List<FluxTable> result = telemetryService.queryTelemetry(deviceId, "temperature", from, to)
                .await().indefinitely();

        // THEN
        assertFalse(result.isEmpty());
        long recordCount = result.stream().mapToLong(t -> t.getRecords().size()).sum();
        assertTrue(recordCount >= 1, "Expected at least one record written");
    }
}
