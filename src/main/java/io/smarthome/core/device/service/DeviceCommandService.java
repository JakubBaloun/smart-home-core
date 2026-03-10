package io.smarthome.core.device.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.MutinyEmitter;
import io.netty.handler.codec.mqtt.MqttQoS;
import io.smallrye.reactive.messaging.mqtt.SendingMqttMessageMetadata;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Channel;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.eclipse.microprofile.reactive.messaging.Metadata;

import java.nio.charset.StandardCharsets;

@ApplicationScoped
public class DeviceCommandService {

    @Inject
    @Channel("z2m-command")
    MutinyEmitter<byte[]> emitter;

    @Inject
    ObjectMapper objectMapper;

    public Uni<Void> setState(String friendlyName, String state) {
        ObjectNode payload = objectMapper.createObjectNode().put("state", state.toUpperCase());
        return send(friendlyName, payload);
    }

    public Uni<Void> setBrightness(String friendlyName, int brightness) {
        ObjectNode payload = objectMapper.createObjectNode().put("brightness", brightness);
        return send(friendlyName, payload);
    }

    public Uni<Void> setColorTemp(String friendlyName, int colorTemp) {
        ObjectNode payload = objectMapper.createObjectNode().put("color_temp", colorTemp);
        return send(friendlyName, payload);
    }

    public Uni<Void> sendRawCommand(String friendlyName, ObjectNode payload) {
        return send(friendlyName, payload);
    }

    private Uni<Void> send(String friendlyName, ObjectNode payload) {
        String topic = "zigbee2mqtt/" + friendlyName + "/set";
        byte[] bytes;
        try {
            bytes = objectMapper.writeValueAsBytes(payload);
        } catch (JsonProcessingException e) {
            return Uni.createFrom().failure(e);
        }

        SendingMqttMessageMetadata metadata = new SendingMqttMessageMetadata(topic, MqttQoS.AT_LEAST_ONCE, false);

        Message<byte[]> message = Message.of(bytes, Metadata.of(metadata));

        return emitter.sendMessage(message)
                .invoke(() -> Log.infof("Command sent to %s: %s", topic, new String(bytes, StandardCharsets.UTF_8)))
                .onFailure().invoke(e -> Log.errorf("Failed to send command to %s: %s", topic, e.getMessage()));
    }
}
