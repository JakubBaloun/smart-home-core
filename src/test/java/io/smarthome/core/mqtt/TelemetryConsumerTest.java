package io.smarthome.core.mqtt;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.mqtt.MqttMessageMetadata;
import io.smarthome.core.telemetry.service.TelemetryService;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TelemetryConsumerTest {

    @Inject
    TelemetryConsumer consumer;

    @InjectMock
    TelemetryService telemetryService;

    @Test
    void testConsume_sensorPayload_writesTelemetry() {
        // GIVEN
        String payload = """
                {"temperature": 22.5, "humidity": 45.2, "battery": 95, "linkquality": 120}
                """;
        when(telemetryService.writeTelemetry(anyString(), anyString(), anyMap()))
                .thenReturn(Uni.createFrom().voidItem());

        // WHEN
        consumer.consume(mockMessage("zigbee2mqtt/living_room_sensor", payload))
                .await().indefinitely();

        // THEN
        verify(telemetryService).writeTelemetry(
                eq("living_room_sensor"),
                eq("sensor_data"),
                eq(Map.of("temperature", 22.5, "humidity", 45.2, "battery", 95, "linkquality", 120))
        );
    }

    @Test
    void testConsume_bridgeTopic_skipped() {
        // GIVEN
        String payload = """
                {"state": "online"}
                """;

        // WHEN
        consumer.consume(mockMessage("zigbee2mqtt/bridge/state", payload))
                .await().indefinitely();

        // THEN
        verifyNoInteractions(telemetryService);
    }

    @Test
    void testConsume_noKnownFields_skipped() {
        // GIVEN - payload with no known telemetry fields
        String payload = """
                {"state": "ON", "brightness": 254, "color_temp": 370}
                """;

        // WHEN
        consumer.consume(mockMessage("zigbee2mqtt/living_room_light", payload))
                .await().indefinitely();

        // THEN
        verifyNoInteractions(telemetryService);
    }

    @Test
    void testConsume_mixedPayload_onlyKnownFieldsWritten() {
        // GIVEN - known + unknown fields mixed
        String payload = """
                {"temperature": 21.0, "state": "ON", "power": 12.5, "brightness": 200}
                """;
        when(telemetryService.writeTelemetry(anyString(), anyString(), anyMap()))
                .thenReturn(Uni.createFrom().voidItem());

        // WHEN
        consumer.consume(mockMessage("zigbee2mqtt/kitchen_sensor", payload))
                .await().indefinitely();

        // THEN - only temperature and power written, not state/brightness
        verify(telemetryService).writeTelemetry(
                eq("kitchen_sensor"),
                eq("sensor_data"),
                eq(Map.of("temperature", 21.0, "power", 12.5))
        );
    }

    @Test
    void testConsume_invalidJson_doesNotThrow() {
        // GIVEN
        String payload = "{ invalid json }";

        // WHEN / THEN - should not throw, message is acked and skipped
        consumer.consume(mockMessage("zigbee2mqtt/some_device", payload))
                .await().indefinitely();

        verifyNoInteractions(telemetryService);
    }

    @Test
    void testConsume_allKnownFields_allWritten() {
        // GIVEN
        String payload = """
                {
                    "temperature": 22.5,
                    "humidity": 60.0,
                    "battery": 80,
                    "power": 10.0,
                    "voltage": 3000,
                    "energy": 0.5,
                    "linkquality": 100
                }
                """;
        when(telemetryService.writeTelemetry(anyString(), anyString(), anyMap()))
                .thenReturn(Uni.createFrom().voidItem());

        // WHEN
        consumer.consume(mockMessage("zigbee2mqtt/full_sensor", payload))
                .await().indefinitely();

        // THEN
        verify(telemetryService).writeTelemetry(
                eq("full_sensor"),
                eq("sensor_data"),
                eq(Map.of(
                        "temperature", 22.5,
                        "humidity", 60.0,
                        "battery", 80,
                        "power", 10.0,
                        "voltage", 3000,
                        "energy", 0.5,
                        "linkquality", 100
                ))
        );
    }

    private Message<byte[]> mockMessage(String topic, String payload) {
        MqttMessageMetadata metadata = mock(MqttMessageMetadata.class);
        when(metadata.getTopic()).thenReturn(topic);

        @SuppressWarnings("unchecked")
        Message<byte[]> message = mock(Message.class);
        when(message.getPayload()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        when(message.getMetadata(MqttMessageMetadata.class)).thenReturn(Optional.of(metadata));
        when(message.ack()).thenReturn(CompletableFuture.completedFuture(null));

        return message;
    }
}
