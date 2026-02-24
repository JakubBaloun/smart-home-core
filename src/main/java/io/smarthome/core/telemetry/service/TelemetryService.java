package io.smarthome.core.telemetry.service;

import com.influxdb.client.QueryApi;
import com.influxdb.client.WriteApiBlocking;
import com.influxdb.client.domain.WritePrecision;
import com.influxdb.client.write.Point;
import com.influxdb.query.FluxTable;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.smarthome.core.exception.TelemetryException;
import io.smarthome.core.telemetry.config.InfluxDbConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TelemetryService {

    @Inject
    WriteApiBlocking writeApi;

    @Inject
    QueryApi queryApi;

    @Inject
    InfluxDbConfig config;

    public Uni<Void> writeTelemetry(String deviceId, String measurement, Map<String, Object> fields) {
        return Uni.createFrom().item(() -> {
                    Point point = Point.measurement(sanitize(measurement))
                            .addTag("device_id", sanitize(deviceId))
                            .addFields(fields)
                            .time(Instant.now(), WritePrecision.MS);
                    writeApi.writePoint(config.bucket(), config.org(), point);
                    return null;
                })
                .invoke(() -> Log.infof("Written telemetry for device %s, measurement %s", deviceId, measurement))
                .onFailure().invoke(e -> Log.errorf("Failed to write telemetry for device %s: %s", deviceId, e.getMessage()))
                .onFailure().transform(e -> new TelemetryException("Failed to write telemetry", e))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .replaceWithVoid();
    }

    public Uni<List<FluxTable>> queryTelemetry(String deviceId, String field, Instant from, Instant to) {
        return Uni.createFrom().item(() -> {
                    String flux = """
                from(bucket: "%s")
                  |> range(start: %s, stop: %s)
                  |> filter(fn: (r) => r._measurement == "%s")
                  |> filter(fn: (r) => r.device_id == "%s")
                  |> filter(fn: (r) => r._field == "%s")
                """.formatted(
                            config.bucket(),
                            from.toString(),
                            to.toString(),
                            sanitize(field),
                            sanitize(deviceId),
                            sanitize(field)
                    );
                    return queryApi.query(flux, config.org());
                })
                .invoke(tables -> Log.infof("Queried telemetry for device %s, field %s, got %d tables", deviceId, field, tables.size()))
                .onFailure().invoke(e -> Log.errorf("Failed to query telemetry for device %s: %s", deviceId, e.getMessage()))
                .onFailure().transform(e -> new TelemetryException("Failed to query telemetry", e))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Input cannot be null or blank");
        }
        return input.replaceAll("[^a-zA-Z0-9_\\-]", "");
    }
}
