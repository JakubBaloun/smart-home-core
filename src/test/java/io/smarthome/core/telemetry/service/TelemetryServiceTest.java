package io.smarthome.core.telemetry.service;

import com.influxdb.client.QueryApi;
import com.influxdb.client.WriteApiBlocking;
import com.influxdb.client.write.Point;
import com.influxdb.query.FluxTable;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.exception.TelemetryException;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TelemetryServiceTest {

    @Inject
    TelemetryService telemetryService;

    @InjectMock
    WriteApiBlocking writeApi;

    @InjectMock
    QueryApi queryApi;

    @Test
    void testWriteTelemetry_success() {
        // GIVEN
        Map<String, Object> fields = Map.of("value", 22.5);

        // WHEN
        telemetryService.writeTelemetry("device-123", "temperature", fields)
                .await().indefinitely();

        // THEN
        verify(writeApi, times(1)).writePoint(eq("telemetry"), eq("smart-home"), any(Point.class));
    }

    @Test
    void testWriteTelemetry_influxFailure() {
        // GIVEN
        doThrow(new RuntimeException("Connection refused"))
                .when(writeApi).writePoint(anyString(), anyString(), any(Point.class));

        // WHEN / THEN
        assertThrows(TelemetryException.class, () ->
                telemetryService.writeTelemetry("device-123", "temperature", Map.of("value", 22.5))
                        .await().indefinitely()
        );
    }

    @Test
    void testWriteTelemetry_sanitizesInput() {
        // GIVEN
        // WHEN - device id se zlými znaky
        telemetryService.writeTelemetry("device; DROP TABLE", "temperature", Map.of("value", 22.5))
                .await().indefinitely();

        // THEN - writePoint byl zavolán (sanitize nehodil výjimku, znaky byly odstraněny)
        verify(writeApi, times(1)).writePoint(anyString(), anyString(), any(Point.class));
    }

    @Test
    void testWriteTelemetry_nullDeviceId() {
        // WHEN / THEN
        assertThrows(Exception.class, () ->
                telemetryService.writeTelemetry(null, "temperature", Map.of("value", 22.5))
                        .await().indefinitely()
        );
        verifyNoInteractions(writeApi);
    }

    @Test
    void testQueryTelemetry_success() {
        // GIVEN
        FluxTable mockTable = mock(FluxTable.class);
        when(queryApi.query(anyString(), anyString())).thenReturn(List.of(mockTable));

        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-01-02T00:00:00Z");

        // WHEN
        List<FluxTable> result = telemetryService.queryTelemetry("device-123", "temperature", from, to)
                .await().indefinitely();

        // THEN
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(queryApi, times(1)).query(anyString(), eq("smart-home"));
    }

    @Test
    void testQueryTelemetry_influxFailure() {
        // GIVEN
        when(queryApi.query(anyString(), anyString()))
                .thenThrow(new RuntimeException("Query failed"));

        // WHEN / THEN
        assertThrows(TelemetryException.class, () ->
                telemetryService.queryTelemetry("device-123", "temperature",
                                Instant.now().minusSeconds(3600), Instant.now())
                        .await().indefinitely()
        );
    }

    @Test
    void testQueryTelemetry_emptyResult() {
        // GIVEN
        when(queryApi.query(anyString(), anyString())).thenReturn(List.of());

        // WHEN
        List<FluxTable> result = telemetryService.queryTelemetry("device-123", "temperature",
                        Instant.now().minusSeconds(3600), Instant.now())
                .await().indefinitely();

        // THEN
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }
}