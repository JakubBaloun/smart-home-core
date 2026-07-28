package io.smarthome.core.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Incoming;

import java.nio.charset.StandardCharsets;

@ApplicationScoped
public class BridgeStateConsumer {

    @Inject
    ObjectMapper objectMapper;

    @Inject
    BridgeStateHolder bridgeState;

    @Incoming("z2m-bridge")
    public Uni<Void> consume(byte[] payload) {
        return Uni.createFrom().item(() -> new String(payload, StandardCharsets.UTF_8))
                .invoke(state -> {
                    boolean online = Z2MStatePayload.isOnline(state, objectMapper);
                    bridgeState.setOnline(online);
                    Log.infof("Zigbee2MQTT bridge is %s", online ? "online" : "offline");
                })
                .onFailure().invoke(e -> Log.errorf("Failed to process bridge state: %s", e.getMessage()))
                .onFailure().recoverWithNull()
                .replaceWithVoid();
    }
}
