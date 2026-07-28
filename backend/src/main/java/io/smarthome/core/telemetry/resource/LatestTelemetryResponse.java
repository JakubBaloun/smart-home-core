package io.smarthome.core.telemetry.resource;

import java.time.Instant;
import java.util.Map;

public record LatestTelemetryResponse(String deviceName, Map<String, Double> values, Instant lastUpdated) {}
