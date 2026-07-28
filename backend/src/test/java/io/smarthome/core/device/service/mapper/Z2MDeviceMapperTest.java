package io.smarthome.core.device.service.mapper;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.Z2MDevicePayload;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class Z2MDeviceMapperTest {

    @Inject
    Z2MDeviceMapper deviceMapper;

    @Test
    void testToEntity_withFullDefinition() {
        // GIVEN
        Z2MDevicePayload payload = new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "Living Room Light",
                "EndDevice",
                "Philips",
                "9290012573A",
                new Z2MDevicePayload.Definition(
                        "Hue white and color light bulb E26/E27/E14",
                        "9290012573A",
                        "Philips"
                )
        );

        // WHEN
        Device device = deviceMapper.toEntity(payload);

        // THEN
        assertNotNull(device);
        assertNull(device.getId(), "ID should be null for new entity");
        assertEquals("00:11:22:33:44:55:66:77", device.getIeeeAddress());
        assertEquals("Living Room Light", device.getFriendlyName());
        assertEquals("Philips", device.getVendor());
        assertEquals("9290012573A", device.getModel());
        assertEquals(DeviceType.LIGHT, device.getType());
        assertTrue(device.isAvailable());
        assertNotNull(device.getLastSeen());
        assertNotNull(device.getCreatedAt(), "CreatedAt should be set by builder default");
        assertNotNull(device.getUpdatedAt(), "UpdatedAt should be set by builder default");
    }

    @Test
    void testToEntity_withoutDefinition() {
        // GIVEN
        Z2MDevicePayload payload = new Z2MDevicePayload(
                "AA:BB:CC:DD:EE:FF:00:11",
                "Unknown Device",
                "EndDevice",
                "Unknown Vendor",
                "Unknown Model",
                null
        );

        // WHEN
        Device device = deviceMapper.toEntity(payload);

        // THEN
        assertNotNull(device);
        assertEquals("AA:BB:CC:DD:EE:FF:00:11", device.getIeeeAddress());
        assertEquals("Unknown Device", device.getFriendlyName());
        assertEquals("Unknown Vendor", device.getVendor());
        assertEquals("Unknown Model", device.getModel());
        assertEquals(DeviceType.OTHER, device.getType());
    }

    @Test
    void testToEntity_prefersDefinitionVendorAndModel() {
        // GIVEN - real Z2M payloads carry vendor/model only under 'definition'
        Z2MDevicePayload payload = new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "temp",
                "EndDevice",
                null,
                null,
                new Z2MDevicePayload.Definition(
                        "Temperature and humidity sensor",
                        "WSDCGQ11LM",
                        "Aqara"
                )
        );

        // WHEN
        Device device = deviceMapper.toEntity(payload);

        // THEN
        assertEquals("Aqara", device.getVendor());
        assertEquals("WSDCGQ11LM", device.getModel());
    }

    @Test
    void testUpdateEntityFromPayload() {
        // GIVEN
        Device existingDevice = Device.builder()
                .id(1L)
                .ieeeAddress("00:11:22:33:44:55:66:77")
                .friendlyName("Old Name")
                .type(DeviceType.OTHER)
                .vendor("Old Vendor")
                .model("Old Model")
                .available(false)
                .build();

        Z2MDevicePayload payload = new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "New Name",
                "EndDevice",
                "New Vendor",
                "New Model",
                new Z2MDevicePayload.Definition(
                        "Smart motion sensor",
                        "New Model",
                        "New Vendor"
                )
        );

        // WHEN
        deviceMapper.updateEntityFromPayload(payload, existingDevice);

        // THEN
        assertEquals(1L, existingDevice.getId(), "ID should not change");
        assertEquals("00:11:22:33:44:55:66:77", existingDevice.getIeeeAddress(), "IEEE address should not change");
        assertEquals("New Name", existingDevice.getFriendlyName());
        assertEquals("New Vendor", existingDevice.getVendor());
        assertEquals("New Model", existingDevice.getModel());
        assertEquals(DeviceType.SENSOR, existingDevice.getType());
        assertFalse(existingDevice.isAvailable(), "sync must not override availability");
        assertNull(existingDevice.getLastSeen(), "sync must not fake lastSeen");
        assertNotNull(existingDevice.getUpdatedAt());
    }

    @Test
    void testDetermineType_light() {
        // GIVEN - various light descriptions
        Z2MDevicePayload lightPayload1 = createPayloadWithDescription("Hue white and color ambiance light bulb");
        Z2MDevicePayload lightPayload2 = createPayloadWithDescription("Smart LED strip");
        Z2MDevicePayload lightPayload3 = createPayloadWithDescription("Ceiling light controller");

        // WHEN
        DeviceType type1 = deviceMapper.determineType(lightPayload1);
        DeviceType type2 = deviceMapper.determineType(lightPayload2);
        DeviceType type3 = deviceMapper.determineType(lightPayload3);

        // THEN
        assertEquals(DeviceType.LIGHT, type1);
        assertEquals(DeviceType.LIGHT, type2);
        assertEquals(DeviceType.LIGHT, type3);
    }

    @Test
    void testDetermineType_sensor() {
        // GIVEN - various sensor descriptions
        Z2MDevicePayload sensorPayload1 = createPayloadWithDescription("Motion sensor with temperature");
        Z2MDevicePayload sensorPayload2 = createPayloadWithDescription("Occupancy detector");
        Z2MDevicePayload sensorPayload3 = createPayloadWithDescription("Smart temperature sensor");

        // WHEN
        DeviceType type1 = deviceMapper.determineType(sensorPayload1);
        DeviceType type2 = deviceMapper.determineType(sensorPayload2);
        DeviceType type3 = deviceMapper.determineType(sensorPayload3);

        // THEN
        assertEquals(DeviceType.SENSOR, type1);
        assertEquals(DeviceType.SENSOR, type2);
        assertEquals(DeviceType.SENSOR, type3);
    }

    @Test
    void testDetermineType_switch() {
        // GIVEN - various switch descriptions
        Z2MDevicePayload switchPayload1 = createPayloadWithDescription("Smart wall switch");
        Z2MDevicePayload switchPayload2 = createPayloadWithDescription("Wireless button");

        // WHEN
        DeviceType type1 = deviceMapper.determineType(switchPayload1);
        DeviceType type2 = deviceMapper.determineType(switchPayload2);

        // THEN
        assertEquals(DeviceType.SWITCH, type1);
        assertEquals(DeviceType.SWITCH, type2);
    }

    @Test
    void testDetermineType_other() {
        // GIVEN
        Z2MDevicePayload otherPayload1 = createPayloadWithDescription("Smart plug with power monitoring");
        Z2MDevicePayload otherPayload2 = createPayloadWithDescription("Hub coordinator");
        Z2MDevicePayload nullDefinitionPayload = new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "Unknown",
                "EndDevice",
                "Vendor",
                "Model",
                null
        );
        Z2MDevicePayload nullDescriptionPayload = new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "Unknown",
                "EndDevice",
                "Vendor",
                "Model",
                new Z2MDevicePayload.Definition(null, "Model", "Vendor")
        );

        // WHEN
        DeviceType type1 = deviceMapper.determineType(otherPayload1);
        DeviceType type2 = deviceMapper.determineType(otherPayload2);
        DeviceType type3 = deviceMapper.determineType(nullDefinitionPayload);
        DeviceType type4 = deviceMapper.determineType(nullDescriptionPayload);

        // THEN
        assertEquals(DeviceType.OTHER, type1);
        assertEquals(DeviceType.OTHER, type2);
        assertEquals(DeviceType.OTHER, type3);
        assertEquals(DeviceType.OTHER, type4);
    }

    @Test
    void testDetermineType_caseInsensitive() {
        // GIVEN - mixed case descriptions
        Z2MDevicePayload upperCasePayload = createPayloadWithDescription("SMART LIGHT BULB");
        Z2MDevicePayload mixedCasePayload = createPayloadWithDescription("Motion SENSOR Device");

        // WHEN
        DeviceType type1 = deviceMapper.determineType(upperCasePayload);
        DeviceType type2 = deviceMapper.determineType(mixedCasePayload);

        // THEN
        assertEquals(DeviceType.LIGHT, type1);
        assertEquals(DeviceType.SENSOR, type2);
    }

    private Z2MDevicePayload createPayloadWithDescription(String description) {
        return new Z2MDevicePayload(
                "00:11:22:33:44:55:66:77",
                "Test Device",
                "EndDevice",
                "Test Vendor",
                "Test Model",
                new Z2MDevicePayload.Definition(description, "Test Model", "Test Vendor")
        );
    }
}
