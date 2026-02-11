package org.acme.device.repository;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.acme.device.Device;
import org.acme.device.DeviceType;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
}
