package org.acme.mqtt;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Incoming;

import io.quarkus.logging.Log;

@ApplicationScoped
public class BridgeStateConsumer {


    @Incoming("zigbee2mqtt-bridge")
    public void consume(byte[] payload) {
        Log.infof("MQTT Message received from bridge: %s", new String(payload));
    }
}
