package io.smarthome.core.mqtt;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.HealthCheckResponseBuilder;
import org.eclipse.microprofile.health.Readiness;

@Readiness
@ApplicationScoped
public class ZigbeeBridgeHealthCheck implements HealthCheck {

    @Inject
    BridgeStateHolder bridgeState;

    @Override
    public HealthCheckResponse call() {
        HealthCheckResponseBuilder builder = HealthCheckResponse.named("zigbee2mqtt-bridge")
                .withData("state", bridgeState.getState().name().toLowerCase());

        bridgeState.getLastChange()
                .ifPresent(instant -> builder.withData("lastChange", instant.toString()));

        // UNKNOWN stays UP so a quiet bridge doesn't block app readiness at startup
        return builder.status(bridgeState.getState() != BridgeStateHolder.State.OFFLINE).build();
    }
}
