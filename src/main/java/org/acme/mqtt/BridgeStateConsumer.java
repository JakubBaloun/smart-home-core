package org.acme.mqtt;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.jboss.logging.Logger;

@ApplicationScoped
public class BridgeStateConsumer {

    private static final Logger LOG = Logger.getLogger(BridgeStateConsumer.class);

    @Incoming("zigbee2mqtt-bridge")
    public void consume(byte[] payload) {
        LOG.infof("MQTT Message received from bridge: %s", new String(payload));
    }
}
