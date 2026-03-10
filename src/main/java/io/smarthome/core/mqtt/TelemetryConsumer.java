package io.smarthome.core.mqtt;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.mqtt.MqttMessageMetadata;
import io.smarthome.core.telemetry.service.TelemetryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class TelemetryConsumer {

    public static final Set<String> KNOWN_FIELDS = Set.of(
            "temperature", "humidity", "battery", "power", "voltage", "energy", "linkquality"
    );

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Inject
    ObjectMapper objectMapper;

    @Inject
    TelemetryService telemetryService;

    @Incoming("z2m-telemetry")
    public Uni<Void> consume(Message<byte[]> message) {
        String topic = message.getMetadata(MqttMessageMetadata.class)
                .map(MqttMessageMetadata::getTopic)
                .orElse("");

        Log.infof("TelemetryConsumer received message on topic: %s", topic);

        if (topic.contains("/bridge/")) {
            Log.debugf("Skipping bridge message on topic: %s", topic);
            return Uni.createFrom().completionStage(message.ack());
        }

        String deviceName = topic.replace("zigbee2mqtt/", "");
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);

        Map<String, Object> parsed;
        try {
            parsed = objectMapper.readValue(payload, MAP_TYPE);
        } catch (JsonProcessingException e) {
            Log.warnf("Failed to parse telemetry payload from %s: %s", deviceName, e.getMessage());
            return Uni.createFrom().completionStage(message.ack());
        }

        Map<String, Object> fields = parsed.entrySet().stream()
                .filter(e -> KNOWN_FIELDS.contains(e.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        if (fields.isEmpty()) {
            Log.debugf("No known telemetry fields in message from %s, skipping", deviceName);
            return Uni.createFrom().completionStage(message.ack());
        }

        return telemetryService.writeTelemetry(deviceName, "sensor_data", fields)
                .onFailure().invoke(e -> Log.errorf("Failed to write telemetry from %s: %s", deviceName, e.getMessage()))
                .onFailure().recoverWithNull()
                .chain(() -> Uni.createFrom().completionStage(message.ack()))
                .replaceWithVoid();
    }
}
