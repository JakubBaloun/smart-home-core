package io.smarthome.core.telemetry.resource;

import java.time.Instant;

public record TelemetryPoint(Instant time, Double value) {}
