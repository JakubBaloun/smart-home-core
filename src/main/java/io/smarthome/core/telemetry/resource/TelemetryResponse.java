package io.smarthome.core.telemetry.resource;

import java.util.List;

public record TelemetryResponse(String deviceName, String field, List<TelemetryPoint> points) {}
