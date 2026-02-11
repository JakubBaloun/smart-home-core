package io.smarthome.core.mqtt;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Incoming;

import io.quarkus.logging.Log;

@ApplicationScoped
public class BridgeStateConsumer {

    @Incoming("z2m-bridge")
    public Uni<Void> consume(byte[] payload) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("MQTT Message received from bridge: %s", new String(payload))
                );
    }
}
