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
                            .addFields(normalizeFields(fields))
                            .time(Instant.now(), WritePrecision.MS);
                    writeApi.writePoint(config.bucket(), config.org(), point);
                    return null;
                })
                .invoke(() -> Log.debugf("Written telemetry for device %s, measurement %s", deviceId, measurement))
                .onFailure().invoke(e -> Log.errorf("Failed to write telemetry for device %s: %s", deviceId, e.getMessage()))
                .onFailure().transform(e -> new TelemetryException("Failed to write telemetry", e))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .replaceWithVoid();
    }

    public Uni<List<FluxTable>> queryTelemetry(String deviceId, String measurement, String field, Instant from, Instant to) {
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
                            sanitize(measurement),
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

    public Uni<List<FluxTable>> queryTelemetryAggregated(String deviceId, String measurement, String field,
                                                          Instant from, Instant to, String aggregate, String window) {
        return Uni.createFrom().item(() -> {
                    String flux = """
                from(bucket: "%s")
                  |> range(start: %s, stop: %s)
                  |> filter(fn: (r) => r._measurement == "%s")
                  |> filter(fn: (r) => r.device_id == "%s")
                  |> filter(fn: (r) => r._field == "%s")
                  |> aggregateWindow(every: %s, fn: %s, createEmpty: false)
                """.formatted(
                            config.bucket(),
                            from.toString(),
                            to.toString(),
                            sanitize(measurement),
                            sanitize(deviceId),
                            sanitize(field),
                            window,
                            aggregate
                    );
                    return queryApi.query(flux, config.org());
                })
                .invoke(tables -> Log.infof("Queried aggregated telemetry for device %s, field %s", deviceId, field))
                .onFailure().invoke(e -> Log.errorf("Failed to query aggregated telemetry for device %s: %s", deviceId, e.getMessage()))
                .onFailure().transform(e -> new TelemetryException("Failed to query telemetry", e))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    public Uni<List<FluxTable>> queryLatest(String deviceId) {
        return Uni.createFrom().item(() -> {
                    String flux = """
                from(bucket: "%s")
                  |> range(start: -24h)
                  |> filter(fn: (r) => r._measurement == "sensor_data")
                  |> filter(fn: (r) => r.device_id == "%s")
                  |> last()
                """.formatted(config.bucket(), sanitize(deviceId));
                    return queryApi.query(flux, config.org());
                })
                .invoke(tables -> Log.infof("Queried latest telemetry for device %s", deviceId))
                .onFailure().invoke(e -> Log.errorf("Failed to query latest telemetry for device %s: %s", deviceId, e.getMessage()))
                .onFailure().transform(e -> new TelemetryException("Failed to query latest telemetry", e))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /**
     * InfluxDB fixes a field's type on first write; a later write with a different
     * type (e.g. long vs double) is rejected for the whole point. Jackson parses
     * JSON numbers as Integer or Double depending on the presence of a decimal
     * point, so all numbers are coerced to double to keep the schema stable.
     */
    private Map<String, Object> normalizeFields(Map<String, Object> fields) {
        return fields.entrySet().stream()
                .filter(e -> {
                    boolean supported = e.getValue() instanceof Number || e.getValue() instanceof Boolean;
                    if (!supported) {
                        Log.debugf("Skipping non-numeric telemetry field '%s' of type %s",
                                e.getKey(), e.getValue() == null ? "null" : e.getValue().getClass().getSimpleName());
                    }
                    return supported;
                })
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue() instanceof Number n ? (Object) n.doubleValue() : e.getValue()
                ));
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Input cannot be null or blank");
        }
        return input.replaceAll("[^a-zA-Z0-9_\\-]", "");
    }
}
