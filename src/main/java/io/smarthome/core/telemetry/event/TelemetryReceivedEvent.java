package io.smarthome.core.telemetry.event;

import java.time.Instant;
import java.util.Map;

public record TelemetryReceivedEvent(
        String deviceName,
        Map<String, Object> fields,
        Instant timestamp
) {}
