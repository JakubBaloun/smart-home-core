package io.smarthome.core.device.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.reactive.messaging.memory.InMemoryConnector;
import io.smallrye.reactive.messaging.memory.InMemorySink;
import io.smallrye.reactive.messaging.mqtt.MqttMessageMetadata;
import jakarta.enterprise.inject.Any;
import jakarta.inject.Inject;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class DeviceCommandServiceTest {

    @Inject
    @Any
    InMemoryConnector connector;

    @Inject
    DeviceCommandService commandService;

    InMemorySink<byte[]> sink;

    @BeforeEach
    void setup() {
        sink = connector.sink("z2m-command");
        sink.clear();
    }

    @Test
    void testSetState_on_publishesCorrectTopicAndPayload() throws IOException {
        commandService.setState("living_room", "ON").await().indefinitely();

        assertEquals(1, sink.received().size());
        Message<byte[]> msg = sink.received().get(0);

        assertTopic(msg, "zigbee2mqtt/living_room/set");
        JsonNode json = parsePayload(msg);
        assertEquals("ON", json.get("state").asText());
    }

    @Test
    void testSetState_off_normalizesToUpperCase() throws IOException {
        commandService.setState("bedroom_light", "off").await().indefinitely();

        Message<byte[]> msg = sink.received().get(0);
        assertTopic(msg, "zigbee2mqtt/bedroom_light/set");
        assertEquals("OFF", parsePayload(msg).get("state").asText());
    }

    @Test
    void testSetBrightness_publishesCorrectPayload() throws IOException {
        commandService.setBrightness("kitchen_light", 200).await().indefinitely();

        Message<byte[]> msg = sink.received().get(0);
        assertTopic(msg, "zigbee2mqtt/kitchen_light/set");
        assertEquals(200, parsePayload(msg).get("brightness").asInt());
    }

    @Test
    void testSetColorTemp_publishesCorrectPayload() throws IOException {
        commandService.setColorTemp("desk_lamp", 370).await().indefinitely();

        Message<byte[]> msg = sink.received().get(0);
        assertTopic(msg, "zigbee2mqtt/desk_lamp/set");
        assertEquals(370, parsePayload(msg).get("color_temp").asInt());
    }

    @Test
    void testSendRawCommand_publishesPayloadAsIs() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        var payload = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree("""
                {"state": "ON", "brightness": 150, "color_temp": 300}
                """);

        commandService.sendRawCommand("lounge_light", payload).await().indefinitely();

        Message<byte[]> msg = sink.received().get(0);
        assertTopic(msg, "zigbee2mqtt/lounge_light/set");
        JsonNode json = parsePayload(msg);
        assertEquals("ON", json.get("state").asText());
        assertEquals(150, json.get("brightness").asInt());
    }

    private void assertTopic(Message<byte[]> msg, String expectedTopic) {
        String topic = msg.getMetadata(MqttMessageMetadata.class)
                .map(MqttMessageMetadata::getTopic)
                .orElseThrow(() -> new AssertionError("No MQTT metadata found"));
        assertEquals(expectedTopic, topic);
    }

    private JsonNode parsePayload(Message<byte[]> msg) throws IOException {
        return new ObjectMapper().readTree(msg.getPayload());
    }
}
