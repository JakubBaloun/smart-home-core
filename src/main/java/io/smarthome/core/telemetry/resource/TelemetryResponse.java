package io.smarthome.core.telemetry.resource;

import java.util.List;

public record TelemetryResponse(String deviceId, String field, List<TelemetryPoint> points) {}
