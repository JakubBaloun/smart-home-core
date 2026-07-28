package io.smarthome.core.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.repository.DeviceRepository;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class DeviceDiscoveryConsumerTest {

    @Inject
    DeviceDiscoveryConsumer consumer;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    DeviceRepository deviceRepository;

    @Inject
    SessionFactory sessionFactory;

    @BeforeEach
    @AfterEach
    void cleanup() {
        sessionFactory.withTransaction((session, tx) ->
                session.createQuery("DELETE FROM Device").executeUpdate()
        ).await().indefinitely();
    }

    @Test
    void testConsume_validPayload() {
        // GIVEN
        String jsonPayload = """
                [
                    {
                        "ieee_address": "00:11:22:33:44:55:66:77",
                        "friendly_name": "Living Room Light",
                        "type": "EndDevice",
                        "vendor": "Philips",
                        "model": "9290012573A",
                        "definition": {
                            "description": "Hue white and color ambiance light",
                            "model": "9290012573A",
                            "vendor": "Philips"
                        }
                    },
                    {
                        "ieee_address": "AA:BB:CC:DD:EE:FF:00:11",
                        "friendly_name": "Kitchen Sensor",
                        "type": "EndDevice",
                        "vendor": "Aqara",
                        "model": "RTCGQ11LM",
                        "definition": {
                            "description": "Motion sensor",
                            "model": "RTCGQ11LM",
                            "vendor": "Aqara"
                        }
                    }
                ]
                """;

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN
        List<Device> devices = sessionFactory.withSession(session ->
                deviceRepository.listAll(session)
        ).await().indefinitely();

        assertEquals(2, devices.size());

        Device light = devices.stream()
                .filter(d -> d.getIeeeAddress().equals("00:11:22:33:44:55:66:77"))
                .findFirst()
                .orElseThrow();
        assertEquals("Living Room Light", light.getFriendlyName());
        assertEquals(DeviceType.LIGHT, light.getType());

        Device sensor = devices.stream()
                .filter(d -> d.getIeeeAddress().equals("AA:BB:CC:DD:EE:FF:00:11"))
                .findFirst()
                .orElseThrow();
        assertEquals("Kitchen Sensor", sensor.getFriendlyName());
        assertEquals(DeviceType.SENSOR, sensor.getType());
    }

    @Test
    void testConsume_emptyArray() {
        // GIVEN - create an existing device
        Device device = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Existing Device")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        String jsonPayload = "[]";

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN - device should be marked unavailable
        Device updated = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertFalse(updated.isAvailable());
    }

    @Test
    void testConsume_invalidJson() {
        // GIVEN
        String invalidJson = "{ invalid json }";

        // WHEN/THEN
        RuntimeException exception = assertThrows(RuntimeException.class, () ->
                consumer.consume(invalidJson).await().indefinitely()
        );

        assertTrue(exception.getMessage().contains("Failed to parse Z2M payload"));
    }

    @Test
    void testConsume_payloadWithMissingFields() {
        // GIVEN - JSON with some optional fields missing
        String jsonPayload = """
                [
                    {
                        "ieee_address": "00:11:22:33:44:55:66:77",
                        "friendly_name": "Minimal Device",
                        "type": "EndDevice"
                    }
                ]
                """;

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN
        Device device = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertNotNull(device);
        assertEquals("Minimal Device", device.getFriendlyName());
        assertEquals(DeviceType.OTHER, device.getType());
        assertTrue(device.isAvailable());
    }

    @Test
    void testConsume_updateExistingDevice() {
        // GIVEN - existing device
        Device existingDevice = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Old Name")
                .type(DeviceType.OTHER)
                .vendor("Old Vendor")
                .available(false)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(existingDevice, session)
        ).await().indefinitely();

        String jsonPayload = """
                [
                    {
                        "ieee_address": "00:11:22:33:44:55:66:77",
                        "friendly_name": "New Name",
                        "type": "Router",
                        "vendor": "New Vendor",
                        "model": "New Model",
                        "definition": {
                            "description": "Smart light bulb",
                            "model": "New Model",
                            "vendor": "New Vendor"
                        }
                    }
                ]
                """;

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN
        Device updated = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertEquals(existingDevice.getId(), updated.getId());
        assertEquals("New Name", updated.getFriendlyName());
        assertEquals(DeviceType.LIGHT, updated.getType());
        assertEquals("New Vendor", updated.getVendor());
        assertFalse(updated.isAvailable(), "sync must not override availability");
    }

    @Test
    void testConsume_complexPayloadWithDefinition() {
        // GIVEN - full Z2M payload with all fields
        String jsonPayload = """
                [
                    {
                        "ieee_address": "00:11:22:33:44:55:66:77",
                        "friendly_name": "Complete Device",
                        "type": "Router",
                        "vendor": "Philips",
                        "model": "9290012573A",
                        "definition": {
                            "description": "Hue white and color light bulb E26/E27/E14",
                            "model": "9290012573A",
                            "vendor": "Philips"
                        }
                    }
                ]
                """;

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN
        Device device = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertNotNull(device);
        assertEquals("Complete Device", device.getFriendlyName());
        assertEquals("Philips", device.getVendor());
        assertEquals("9290012573A", device.getModel());
        assertEquals(DeviceType.LIGHT, device.getType());
        assertTrue(device.isAvailable());
    }

    @Test
    void testConsume_marksUnseenDevicesUnavailable() {
        // GIVEN - create two devices
        Device device1 = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Active Device")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();

        Device device2 = Device.builder()
                .ieeeAddress("AA:BB:CC:DD:EE:FF:00:11")
                .friendlyName("Inactive Device")
                .type(DeviceType.SENSOR)
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device1, session)
                        .chain(() -> deviceRepository.save(device2, session))
        ).await().indefinitely();

        // Sync only device1
        String jsonPayload = """
                [
                    {
                        "ieee_address": "00:11:22:33:44:55:66:77",
                        "friendly_name": "Active Device",
                        "type": "EndDevice",
                        "definition": {
                            "description": "Light",
                            "model": "Model",
                            "vendor": "Vendor"
                        }
                    }
                ]
                """;

        // WHEN
        consumer.consume(jsonPayload).await().indefinitely();

        // THEN
        Device activeDevice = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        Device inactiveDevice = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("AA:BB:CC:DD:EE:FF:00:11", session)
        ).await().indefinitely();

        assertTrue(activeDevice.isAvailable());
        assertFalse(inactiveDevice.isAvailable());
    }
}
