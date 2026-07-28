package io.smarthome.core.device.service;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.Z2MDevicePayload;
import io.smarthome.core.device.repository.DeviceRepository;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class DeviceServiceTest {

    @Inject
    DeviceService deviceService;

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
    void testSyncDevices_createNewDevices() {
        // GIVEN
        List<Z2MDevicePayload> payloads = List.of(
                new Z2MDevicePayload(
                        "00:11:22:33:44:55:66:77",
                        "Living Room Light",
                        "EndDevice",
                        "Philips",
                        "9290012573A",
                        new Z2MDevicePayload.Definition(
                                "Hue white and color ambiance light",
                                "9290012573A",
                                "Philips"
                        )
                ),
                new Z2MDevicePayload(
                        "AA:BB:CC:DD:EE:FF:00:11",
                        "Kitchen Sensor",
                        "EndDevice",
                        "Aqara",
                        "RTCGQ11LM",
                        new Z2MDevicePayload.Definition(
                                "Motion sensor",
                                "RTCGQ11LM",
                                "Aqara"
                        )
                )
        );

        // WHEN
        deviceService.syncDevices(payloads).await().indefinitely();

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
        assertEquals("Philips", light.getVendor());
        assertTrue(light.isAvailable());

        Device sensor = devices.stream()
                .filter(d -> d.getIeeeAddress().equals("AA:BB:CC:DD:EE:FF:00:11"))
                .findFirst()
                .orElseThrow();
        assertEquals("Kitchen Sensor", sensor.getFriendlyName());
        assertEquals(DeviceType.SENSOR, sensor.getType());
        assertTrue(sensor.isAvailable());
    }

    @Test
    void testSyncDevices_updateExistingDevices() {
        // GIVEN - create existing device
        Device existingDevice = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Old Name")
                .type(DeviceType.OTHER)
                .vendor("Old Vendor")
                .model("Old Model")
                .available(false)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(existingDevice, session)
        ).await().indefinitely();

        List<Z2MDevicePayload> payloads = List.of(
                new Z2MDevicePayload(
                        "00:11:22:33:44:55:66:77",
                        "New Name",
                        "EndDevice",
                        "New Vendor",
                        "New Model",
                        new Z2MDevicePayload.Definition(
                                "Smart light bulb",
                                "New Model",
                                "New Vendor"
                        )
                )
        );

        // WHEN
        deviceService.syncDevices(payloads).await().indefinitely();

        // THEN
        Device updated = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertNotNull(updated);
        assertEquals(existingDevice.getId(), updated.getId(), "ID should remain the same");
        assertEquals("New Name", updated.getFriendlyName());
        assertEquals(DeviceType.LIGHT, updated.getType());
        assertEquals("New Vendor", updated.getVendor());
        assertFalse(updated.isAvailable(), "sync must not override availability");
    }

    @Test
    void testSyncDevices_markUnavailableDevices() {
        // GIVEN - create multiple devices
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

        // Sync only device1, device2 should be marked unavailable
        List<Z2MDevicePayload> payloads = List.of(
                new Z2MDevicePayload(
                        "00:11:22:33:44:55:66:77",
                        "Active Device",
                        "EndDevice",
                        "Vendor",
                        "Model",
                        new Z2MDevicePayload.Definition("Light", "Model", "Vendor")
                )
        );

        // WHEN
        deviceService.syncDevices(payloads).await().indefinitely();

        // THEN
        Device activeDevice = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        Device inactiveDevice = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("AA:BB:CC:DD:EE:FF:00:11", session)
        ).await().indefinitely();

        assertTrue(activeDevice.isAvailable(), "Device in sync list should be available");
        assertFalse(inactiveDevice.isAvailable(), "Device not in sync list should be unavailable");
    }

    @Test
    void testSyncDevices_emptyList() {
        // GIVEN - existing devices
        Device device = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Test Device")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        // WHEN - sync with empty list
        deviceService.syncDevices(List.of()).await().indefinitely();

        // THEN - all devices should be marked unavailable
        Device updated = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertFalse(updated.isAvailable(), "Device should be marked unavailable when sync list is empty");
    }

    @Test
    void testSyncDevices_mixedCreateAndUpdate() {
        // GIVEN - one existing device
        Device existingDevice = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Existing Device")
                .type(DeviceType.LIGHT)
                .available(false)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(existingDevice, session)
        ).await().indefinitely();

        List<Z2MDevicePayload> payloads = List.of(
                // Update existing
                new Z2MDevicePayload(
                        "00:11:22:33:44:55:66:77",
                        "Updated Device",
                        "EndDevice",
                        "Vendor1",
                        "Model1",
                        new Z2MDevicePayload.Definition("Light", "Model1", "Vendor1")
                ),
                // Create new
                new Z2MDevicePayload(
                        "AA:BB:CC:DD:EE:FF:00:11",
                        "New Device",
                        "EndDevice",
                        "Vendor2",
                        "Model2",
                        new Z2MDevicePayload.Definition("Sensor", "Model2", "Vendor2")
                )
        );

        // WHEN
        deviceService.syncDevices(payloads).await().indefinitely();

        // THEN
        List<Device> allDevices = sessionFactory.withSession(session ->
                deviceRepository.listAll(session)
        ).await().indefinitely();

        assertEquals(2, allDevices.size());

        Device updated = allDevices.stream()
                .filter(d -> d.getIeeeAddress().equals("00:11:22:33:44:55:66:77"))
                .findFirst()
                .orElseThrow();
        assertEquals("Updated Device", updated.getFriendlyName());
        assertFalse(updated.isAvailable(), "sync must not override availability");

        Device created = allDevices.stream()
                .filter(d -> d.getIeeeAddress().equals("AA:BB:CC:DD:EE:FF:00:11"))
                .findFirst()
                .orElseThrow();
        assertEquals("New Device", created.getFriendlyName());
        assertTrue(created.isAvailable());
    }

    @Test
    void testGetAllDevices() {
        // GIVEN
        Device device1 = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Device 1")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();

        Device device2 = Device.builder()
                .ieeeAddress("AA:BB:CC:DD:EE:FF:00:11")
                .friendlyName("Device 2")
                .type(DeviceType.SENSOR)
                .available(false)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device1, session)
                        .chain(() -> deviceRepository.save(device2, session))
        ).await().indefinitely();

        // WHEN
        List<Device> devices = deviceService.getAllDevices().await().indefinitely();

        // THEN
        assertNotNull(devices);
        assertEquals(2, devices.size());
    }

    @Test
    void testGetDeviceById_found() {
        // GIVEN
        Device device = Device.builder()
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Test Device")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        // WHEN
        Device found = deviceService.getDeviceById(device.getId()).await().indefinitely();

        // THEN
        assertNotNull(found);
        assertEquals(device.getId(), found.getId());
        assertEquals("Test Device", found.getFriendlyName());
    }

    @Test
    void testGetDeviceById_notFound() {
        // WHEN/THEN
        assertThrows(Exception.class, () ->
                deviceService.getDeviceById(999L).await().indefinitely()
        );
    }
}
