# MQTT Patterns

> MQTT integration patterns for Smart Home Core with Eclipse Mosquitto and Zigbee2MQTT.

## Architecture Overview

Smart Home Core integrates with MQTT for device communication:

```
┌─────────────────┐     MQTT      ┌──────────────┐
│ Zigbee Devices  │◄─────────────►│ Zigbee2MQTT  │
└─────────────────┘                └──────┬───────┘
                                          │ MQTT
                     ┌────────────────────┼──────────┐
                     │                    │          │
                ┌────▼────┐         ┌────▼──────┐   │
                │ Mosquitto│         │ Smart Home │   │
                │  Broker  │◄───────►│    Core   │   │
                └──────────┘         └───────────┘   │
                                           │ MQTT    │
                                           └─────────┘
```

**Key Components:**
- **Eclipse Mosquitto** - MQTT broker
- **Zigbee2MQTT** - Zigbee to MQTT bridge
- **SmallRye Reactive Messaging** - Quarkus MQTT integration

## Configuration

### MQTT Connection (application.yaml)

```yaml
# MQTT Broker connection
mqtt:
  broker-url: ${MQTT_BROKER_URL:tcp://localhost:1883}
  client-id: smart-home-core
  username: ${MQTT_USERNAME:}
  password: ${MQTT_PASSWORD:}

# SmallRye Reactive Messaging configuration
mp:
  messaging:
    incoming:
      zigbee-devices:
        connector: smallrye-mqtt
        host: ${MQTT_BROKER_URL:tcp://localhost:1883}
        client-id: smart-home-consumer
        topic: zigbee2mqtt/#

    outgoing:
      zigbee-commands:
        connector: smallrye-mqtt
        host: ${MQTT_BROKER_URL:tcp://localhost:1883}
        client-id: smart-home-producer
        topic: zigbee2mqtt/[device]/set
```

## Consuming Messages

### Basic Consumer Pattern

```java
@ApplicationScoped
public class Zigbee2MqttConsumer {

    @Inject
    DeviceService deviceService;

    @Incoming("zigbee-devices")
    public Uni<Void> consumeDeviceMessage(Message<String> message) {
        String topic = message.getMetadata(IncomingMqttMetadata.class)
                .map(IncomingMqttMetadata::getTopic)
                .orElse("unknown");

        String payload = message.getPayload();

        return processMessage(topic, payload)
                .chain(() -> Uni.createFrom().completionStage(message.ack()))
                .onFailure().invoke(err ->
                    log.error("Failed to process MQTT message from topic: {}", topic, err)
                );
    }

    private Uni<Void> processMessage(String topic, String payload) {
        // Parse and process the message
        if (topic.startsWith("zigbee2mqtt/bridge/")) {
            return processBridgeMessage(topic, payload);
        } else {
            return processDeviceMessage(topic, payload);
        }
    }
}
```

### Topic Filtering

```java
@ApplicationScoped
public class DeviceStateConsumer {

    @Incoming("zigbee-devices")
    public Uni<Void> consumeStateUpdate(Message<String> message) {
        String topic = extractTopic(message);

        // Filter: only process device state updates
        if (!topic.matches("zigbee2mqtt/[^/]+") || topic.contains("bridge")) {
            return Uni.createFrom().completionStage(message.ack());
        }

        String deviceId = extractDeviceId(topic);
        String payload = message.getPayload();

        return deviceService.updateStateFromMqtt(deviceId, payload)
                .chain(() -> Uni.createFrom().completionStage(message.ack()));
    }

    private String extractDeviceId(String topic) {
        return topic.replace("zigbee2mqtt/", "").split("/")[0];
    }
}
```

## Publishing Messages

### Basic Producer Pattern

```java
@ApplicationScoped
public class DeviceCommandService {

    @Inject
    @Channel("zigbee-commands")
    MqttPublisher<String> publisher;

    public Uni<Void> turnOnDevice(String deviceId) {
        String topic = String.format("zigbee2mqtt/%s/set", deviceId);
        String payload = """
                {
                  "state": "ON"
                }
                """;

        return publisher.publish(topic, payload)
                .invoke(() -> log.info("Sent ON command to device: {}", deviceId))
                .onFailure().invoke(err ->
                    log.error("Failed to send command to device: {}", deviceId, err)
                );
    }

    public Uni<Void> setBrightness(String deviceId, int brightness) {
        String topic = String.format("zigbee2mqtt/%s/set", deviceId);
        String payload = String.format("""
                {
                  "brightness": %d
                }
                """, brightness);

        return publisher.publish(topic, payload);
    }
}
```

### Custom Publisher with Topic Configuration

```java
@ApplicationScoped
public class MqttPublisher<T> {

    @Inject
    @Channel("zigbee-commands")
    Emitter<String> emitter;

    public Uni<Void> publish(String topic, String payload) {
        OutgoingMqttMetadata metadata = OutgoingMqttMetadata.builder()
                .withTopic(topic)
                .withQos(1)  // At least once delivery
                .withRetain(false)
                .build();

        Message<String> message = Message.of(payload)
                .addMetadata(metadata);

        return Uni.createFrom().completionStage(
                emitter.send(message)
        );
    }
}
```

## Zigbee2MQTT Integration

### Device Discovery

Zigbee2MQTT publishes device info to `zigbee2mqtt/bridge/devices`:

```java
@ApplicationScoped
public class DeviceDiscoveryConsumer {

    @Inject
    DeviceService deviceService;

    @Incoming("zigbee-devices")
    public Uni<Void> handleBridgeMessages(Message<String> message) {
        String topic = extractTopic(message);

        if (!topic.equals("zigbee2mqtt/bridge/devices")) {
            return Uni.createFrom().completionStage(message.ack());
        }

        String payload = message.getPayload();

        return parseDeviceList(payload)
                .chain(devices -> Multi.createFrom().iterable(devices)
                        .onItem().transformToUniAndMerge(deviceService::syncDevice)
                        .collect().asList()
                )
                .replaceWithVoid()
                .chain(() -> Uni.createFrom().completionStage(message.ack()));
    }

    private Uni<List<ZigbeeDevice>> parseDeviceList(String json) {
        // Parse JSON array of devices
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<ZigbeeDevice> devices = mapper.readValue(
                    json,
                    new TypeReference<List<ZigbeeDevice>>() {}
            );
            return Uni.createFrom().item(devices);
        } catch (Exception e) {
            return Uni.createFrom().failure(e);
        }
    }
}
```

### Device State Updates

Zigbee2MQTT publishes state to `zigbee2mqtt/[device_id]`:

```java
public Uni<Void> handleDeviceState(String deviceId, String payload) {
    return parseStateUpdate(payload)
            .chain(state -> deviceService.updateState(deviceId, state))
            .invoke(device -> log.info("Updated device state: {} -> {}", deviceId, device.getState()))
            .replaceWithVoid();
}

private Uni<DeviceState> parseStateUpdate(String json) {
    try {
        ObjectMapper mapper = new ObjectMapper();
        return Uni.createFrom().item(
                mapper.readValue(json, DeviceState.class)
        );
    } catch (Exception e) {
        return Uni.createFrom().failure(
                new InvalidPayloadException("Failed to parse state: " + json, e)
        );
    }
}
```

## Common MQTT Topics

### Zigbee2MQTT Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `zigbee2mqtt/bridge/state` | Subscribe | Bridge online/offline status |
| `zigbee2mqtt/bridge/devices` | Subscribe | List of all paired devices |
| `zigbee2mqtt/bridge/event` | Subscribe | Pairing events, device announcements |
| `zigbee2mqtt/bridge/config` | Pub/Sub | Bridge configuration |
| `zigbee2mqtt/[device]/set` | Publish | Send commands to device |
| `zigbee2mqtt/[device]` | Subscribe | Receive device state updates |
| `zigbee2mqtt/[device]/get` | Publish | Request current state |

### Example Payloads

**Device State (Subscribe):**
```json
{
  "battery": 100,
  "linkquality": 120,
  "state": "ON",
  "brightness": 254,
  "color_temp": 370,
  "last_seen": "2026-02-11T15:30:00.000Z"
}
```

**Device Command (Publish):**
```json
{
  "state": "ON",
  "brightness": 128,
  "transition": 2
}
```

## Error Handling

### Connection Failures

```java
@ApplicationScoped
public class MqttConnectionMonitor {

    @Inject
    Event<MqttDisconnectedEvent> disconnectEvent;

    @Incoming("zigbee-devices")
    public Uni<Void> monitorConnection(Message<String> message) {
        return processMessage(message)
                .onFailure(MqttConnectionException.class)
                .invoke(err -> {
                    log.error("MQTT connection lost", err);
                    disconnectEvent.fire(new MqttDisconnectedEvent());
                })
                .onFailure(MqttConnectionException.class)
                .recoverWithUni(() -> waitForReconnection());
    }

    private Uni<Void> waitForReconnection() {
        return Uni.createFrom().voidItem()
                .onItem().delayIt().by(Duration.ofSeconds(5))
                .invoke(() -> log.info("Attempting MQTT reconnection..."));
    }
}
```

### Message Processing Failures

```java
@Incoming("zigbee-devices")
public Uni<Void> consumeWithRetry(Message<String> message) {
    return processMessage(message)
            .onFailure().retry()
            .withBackOff(Duration.ofSeconds(1), Duration.ofSeconds(10))
            .atMost(3)
            .chain(() -> Uni.createFrom().completionStage(message.ack()))
            .onFailure().invoke(err -> {
                log.error("Failed after retries, sending to DLQ", err);
                // Send to dead letter queue or log for manual review
            })
            .onFailure().recoverWithUni(() ->
                Uni.createFrom().completionStage(message.nack(new Exception("Processing failed")))
            );
}
```

## Testing MQTT

### Mock MQTT Consumer

```java
@QuarkusTest
class DeviceConsumerTest {

    @Inject
    DeviceService deviceService;

    @Test
    void shouldProcessDeviceStateUpdate() {
        String payload = """
                {
                  "state": "ON",
                  "brightness": 254
                }
                """;

        // Test the processing logic directly
        Uni<Void> result = processDeviceState("device-1", payload);

        assertDoesNotThrow(() -> result.await().indefinitely());

        // Verify device was updated
        Device device = deviceService.getDevice(1L).await().indefinitely();
        assertEquals("ON", device.getState());
    }
}
```

### Integration Tests with Testcontainers

```java
@QuarkusIntegrationTest
@TestProfile(MqttTestProfile.class)
class MqttIntegrationTest {

    @Container
    static GenericContainer<?> mosquitto = new GenericContainer<>("eclipse-mosquitto:2")
            .withExposedPorts(1883);

    @Test
    void shouldReceiveMqttMessage() {
        // Publish test message via Testcontainers
        // Verify message is processed by application
    }
}
```

## Best Practices

1. **Always acknowledge messages** - Use `message.ack()` after successful processing
2. **Handle failures gracefully** - Use retry with backoff, then DLQ
3. **Log MQTT activity** - Topic, payload preview, processing time
4. **Use QoS appropriately** - QoS 1 for commands, QoS 0 for frequent telemetry
5. **Validate payloads** - Parse and validate JSON before processing
6. **Keep topics organized** - Follow Zigbee2MQTT conventions
7. **Monitor connection health** - Implement reconnection logic
