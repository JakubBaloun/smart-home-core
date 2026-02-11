package io.smarthome.core.device.repository;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class DeviceRepositoryTest {

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
    void testSaveAndFindById() {
        //GIVEN
        Device device = Device.builder()
                .ieeeAddress("00:11:22:33:44:55")
                .friendlyName("Test Device")
                .type(DeviceType.SENSOR)
                .vendor("Test Vendor")
                .model("Test Model")
                .available(true)
                .build();

        //WHEN
        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        Device found = sessionFactory.withSession(session ->
                deviceRepository.findById(device.getId(), session)
        ).await().indefinitely();

        //THEN
        assertNotNull(device.getId(), "Device ID should not be null after saving");

        assertNotNull(found, "Device should be found by ID");
        assertNotNull(found.getIeeeAddress(), "IEEE Address should not be null");
    }

    @Test
    void testFindByIeeeAddress() {
        //GIVEN
        Device device = Device.builder()
                .ieeeAddress("AA:BB:CC:DD:EE:FF")
                .friendlyName("Another Device")
                .type(DeviceType.SENSOR)
                .vendor("Another Vendor")
                .model("Another Model")
                .available(false)
                .build();

        //WHEN
        sessionFactory.withTransaction(session ->
                deviceRepository.save(device, session)
        ).await().indefinitely();

        Device found = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("AA:BB:CC:DD:EE:FF", session)
        ).await().indefinitely();

        //THEN
        assertNotNull(found, "Device should be found by IEEE address");
        assertNotNull(found.getFriendlyName(), "Friendly name should not be null");
    }

    @Test
    void testFindByType() {
        //GIVEN
        Device device1 = Device.builder()
                .ieeeAddress("11:22:33:44:55:66")
                .friendlyName("Sensor 1")
                .type(DeviceType.SENSOR)
                .vendor("Vendor 1")
                .model("Model 1")
                .available(true)
                .build();

        Device device2 = Device.builder()
                .ieeeAddress("22:33:44:55:66:77")
                .friendlyName("Actuator 1")
                .type(DeviceType.SENSOR)
                .vendor("Vendor 2")
                .model("Model 2")
                .available(true)
                .build();

        Device device3 = Device.builder()
                .ieeeAddress("33:44:55:66:77:88")
                .friendlyName("Actuator 2")
                .type(DeviceType.OTHER)
                .vendor("Vendor 3")
                .model("Model 3")
                .available(false)
                .build();

        //WHEN
        sessionFactory.withTransaction(session ->
                deviceRepository.save(device1, session)
        ).await().indefinitely();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device2, session)
        ).await().indefinitely();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device3, session)
        ).await().indefinitely();

        var foundDevices = sessionFactory.withSession(session ->
                deviceRepository.findByType(DeviceType.SENSOR, session)
        ).await().indefinitely();

        //THEN
        assertNotNull(foundDevices, "Found devices list should not be null");
        assertEquals(2, foundDevices.size(), "There should be 2 devices of type SENSOR");
    }

    @Test
    void testMarkUnavailableNotIn_withActiveAddresses() {
        // GIVEN
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

        Device device3 = Device.builder()
                .ieeeAddress("11:22:33:44:55:66:77:88")
                .friendlyName("Another Active Device")
                .type(DeviceType.SWITCH)
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device1, session)
                        .chain(() -> deviceRepository.save(device2, session))
                        .chain(() -> deviceRepository.save(device3, session))
        ).await().indefinitely();

        // Mark only device1 and device3 as active
        List<String> activeAddresses = List.of(
                "00:11:22:33:44:55:66:77",
                "11:22:33:44:55:66:77:88"
        );

        // WHEN
        Integer updatedCount = sessionFactory.withTransaction(session ->
                deviceRepository.markUnavailableNotIn(activeAddresses, session)
        ).await().indefinitely();

        // THEN
        assertEquals(1, updatedCount, "Should update 1 device");

        Device activeDevice1 = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        Device inactiveDevice = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("AA:BB:CC:DD:EE:FF:00:11", session)
        ).await().indefinitely();

        Device activeDevice2 = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("11:22:33:44:55:66:77:88", session)
        ).await().indefinitely();

        assertTrue(activeDevice1.isAvailable(), "Device in active list should remain available");
        assertFalse(inactiveDevice.isAvailable(), "Device not in active list should be marked unavailable");
        assertTrue(activeDevice2.isAvailable(), "Device in active list should remain available");
    }

    @Test
    void testMarkUnavailableNotIn_withEmptyList() {
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
                .available(true)
                .build();

        sessionFactory.withTransaction(session ->
                deviceRepository.save(device1, session)
                        .chain(() -> deviceRepository.save(device2, session))
        ).await().indefinitely();

        // WHEN - pass empty list
        Integer updatedCount = sessionFactory.withTransaction(session ->
                deviceRepository.markUnavailableNotIn(List.of(), session)
        ).await().indefinitely();

        // THEN - all devices should be marked unavailable
        assertEquals(2, updatedCount, "Should update all devices");

        List<Device> allDevices = sessionFactory.withSession(session ->
                deviceRepository.listAll(session)
        ).await().indefinitely();

        assertTrue(allDevices.stream().noneMatch(Device::isAvailable),
                "All devices should be marked unavailable when list is empty");
    }

    @Test
    void testMarkUnavailableNotIn_withNullList() {
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

        // WHEN - pass null list
        Integer updatedCount = sessionFactory.withTransaction(session ->
                deviceRepository.markUnavailableNotIn(null, session)
        ).await().indefinitely();

        // THEN - all devices should be marked unavailable
        assertEquals(1, updatedCount, "Should update all devices");

        Device updated = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertFalse(updated.isAvailable(), "Device should be marked unavailable when list is null");
    }

    @Test
    void testMarkUnavailableNotIn_noMatchingDevices() {
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

        // Pass the device's address in the active list
        List<String> activeAddresses = List.of("00:11:22:33:44:55:66:77");

        // WHEN
        Integer updatedCount = sessionFactory.withTransaction(session ->
                deviceRepository.markUnavailableNotIn(activeAddresses, session)
        ).await().indefinitely();

        // THEN - no devices should be updated
        assertEquals(0, updatedCount, "Should not update any devices");

        Device unchanged = sessionFactory.withSession(session ->
                deviceRepository.findByIeeeAddress("00:11:22:33:44:55:66:77", session)
        ).await().indefinitely();

        assertTrue(unchanged.isAvailable(), "Device should remain available");
    }
}
