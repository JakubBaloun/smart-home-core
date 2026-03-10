package io.smarthome.core.telemetry.resource;

import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.mqtt.TelemetryConsumer;
import io.smarthome.core.telemetry.service.TelemetryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestPath;
import org.jboss.resteasy.reactive.RestQuery;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Path("/api/telemetry")
@ApplicationScoped
public class TelemetryResource {

    private static final Set<String> VALID_AGGREGATES = Set.of("mean", "max", "min");
    private static final Pattern VALID_WINDOW = Pattern.compile("^\\d+[smhd]$");

    @Inject
    TelemetryService telemetryService;

    @GET
    @Path("/{deviceId}")
    public Uni<TelemetryResponse> getHistory(
            @RestPath String deviceId,
            @RestQuery String field,
            @RestQuery String from,
            @RestQuery String to,
            @RestQuery String aggregate,
            @RestQuery String window) {

        Log.infof("Request received for telemetry history: device=%s, field=%s", deviceId, field);

        ValidatedParams params = validateHistoryParams(field, from, to, aggregate, window);

        Uni<List<FluxTable>> query = aggregate != null
                ? telemetryService.queryTelemetryAggregated(deviceId, "sensor_data", field, params.from(), params.to(), aggregate, window)
                : telemetryService.queryTelemetry(deviceId, "sensor_data", field, params.from(), params.to());

        return query.map(tables -> {
            List<TelemetryPoint> points = tables.stream()
                    .flatMap(t -> t.getRecords().stream())
                    .filter(r -> r.getValue() != null)
                    .map(r -> new TelemetryPoint(r.getTime(), ((Number) r.getValue()).doubleValue()))
                    .toList();
            return new TelemetryResponse(deviceId, field, points);
        });
    }

    @GET
    @Path("/{deviceId}/latest")
    public Uni<LatestTelemetryResponse> getLatest(@RestPath String deviceId) {
        Log.infof("Request received for latest telemetry: device=%s", deviceId);

        return telemetryService.queryLatest(deviceId).map(tables -> {
            Map<String, Double> values = new LinkedHashMap<>();
            Instant lastUpdated = null;

            for (FluxTable table : tables) {
                for (FluxRecord record : table.getRecords()) {
                    if (record.getField() != null && record.getValue() != null) {
                        values.put(record.getField(), ((Number) record.getValue()).doubleValue());
                        if (record.getTime() != null && (lastUpdated == null || record.getTime().isAfter(lastUpdated))) {
                            lastUpdated = record.getTime();
                        }
                    }
                }
            }

            return new LatestTelemetryResponse(deviceId, values, lastUpdated);
        });
    }

    private ValidatedParams validateHistoryParams(String field, String from, String to, String aggregate, String window) {
        if (field == null || !TelemetryConsumer.KNOWN_FIELDS.contains(field)) {
            throw new BadRequestException("'field' must be one of: " + String.join(", ", TelemetryConsumer.KNOWN_FIELDS));
        }
        if (from == null || to == null) {
            throw new BadRequestException("Query parameters 'from' and 'to' are required");
        }

        Instant fromInstant;
        Instant toInstant;
        try {
            fromInstant = Instant.parse(from);
            toInstant = Instant.parse(to);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("'from' and 'to' must be valid ISO-8601 timestamps (e.g. 2024-01-01T00:00:00Z)");
        }

        if (fromInstant.isAfter(toInstant)) {
            throw new BadRequestException("'from' must be before 'to'");
        }

        if (aggregate != null) {
            if (!VALID_AGGREGATES.contains(aggregate)) {
                throw new BadRequestException("'aggregate' must be one of: " + String.join(", ", VALID_AGGREGATES));
            }
            if (window == null || !VALID_WINDOW.matcher(window).matches()) {
                throw new BadRequestException("'window' must be a valid duration like 1m, 5m, 1h, 1d");
            }
        }

        return new ValidatedParams(fromInstant, toInstant);
    }

    private record ValidatedParams(Instant from, Instant to) {}
}
