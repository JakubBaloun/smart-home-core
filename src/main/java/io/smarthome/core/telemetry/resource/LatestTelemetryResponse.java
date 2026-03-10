package io.smarthome.core.telemetry.resource;

import java.time.Instant;
import java.util.Map;

public record LatestTelemetryResponse(String deviceId, Map<String, Double> values, Instant lastUpdated) {}
