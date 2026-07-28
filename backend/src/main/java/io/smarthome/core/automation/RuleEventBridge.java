package io.smarthome.core.automation;

import io.quarkus.logging.Log;
import io.smarthome.core.device.event.DevicesSyncedEvent;
import io.smarthome.core.telemetry.event.TelemetryReceivedEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.Map;

@ApplicationScoped
public class RuleEventBridge {

    @Inject
    RuleEngine ruleEngine;

    void onDevicesSynced(@Observes DevicesSyncedEvent event) {
        RuleContext context = RuleContext.builder()
                .eventType("devices-synced")
                .data(Map.of("syncedIeeeAddresses", event.syncedIeeeAddresses(), "count", event.count()))
                .timestamp(Instant.now())
                .build();
        dispatch(context);
    }

    void onTelemetryReceived(@Observes TelemetryReceivedEvent event) {
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received")
                .deviceId(event.deviceName())
                .data(event.fields())
                .timestamp(event.timestamp())
                .build();
        dispatch(context);
    }

    private void dispatch(RuleContext context) {
        ruleEngine.fire(context)
                .subscribe().with(
                        ignored -> {},
                        failure -> Log.errorf(failure, "Unhandled failure dispatching rules for event '%s'", context.eventType())
                );
    }
}
