package io.smarthome.core.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.mqtt.MqttMessageMetadata;
import io.smarthome.core.device.service.DeviceService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;

import java.nio.charset.StandardCharsets;

@ApplicationScoped
public class DeviceAvailabilityConsumer {

    private static final String TOPIC_PREFIX = "zigbee2mqtt/";
    private static final String TOPIC_SUFFIX = "/availability";

    @Inject
    ObjectMapper objectMapper;

    @Inject
    DeviceService deviceService;

    @Incoming("z2m-availability")
    public Uni<Void> consume(Message<byte[]> message) {
        String topic = message.getMetadata(MqttMessageMetadata.class)
                .map(MqttMessageMetadata::getTopic)
                .orElse("");

        if (!topic.startsWith(TOPIC_PREFIX) || !topic.endsWith(TOPIC_SUFFIX)) {
            return Uni.createFrom().completionStage(message.ack());
        }

        String friendlyName = topic.substring(TOPIC_PREFIX.length(), topic.length() - TOPIC_SUFFIX.length());
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        boolean online = Z2MStatePayload.isOnline(payload, objectMapper);

        return deviceService.updateAvailability(friendlyName, online)
                .onFailure().invoke(e -> Log.errorf("Failed to update availability of '%s': %s", friendlyName, e.getMessage()))
                .onFailure().recoverWithNull()
                .chain(() -> Uni.createFrom().completionStage(message.ack()))
                .replaceWithVoid();
    }
}
