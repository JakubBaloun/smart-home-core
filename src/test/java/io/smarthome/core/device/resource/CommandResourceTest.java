package io.smarthome.core.device.resource;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.common.exception.DeviceUnavailableException;
import io.smarthome.core.common.exception.ResourceNotFoundException;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import io.smarthome.core.device.service.DeviceCommandService;
import io.smarthome.core.device.service.DeviceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@QuarkusTest
public class CommandResourceTest {

    @InjectMock
    DeviceService deviceService;

    @InjectMock
    DeviceCommandService commandService;

    private Device availableDevice;
    private Device unavailableDevice;

    @BeforeEach
    void setup() {
        availableDevice = Device.builder()
                .ieeeAddress("00:11:22:33:44:55")
                .friendlyName("living_room_light")
                .type(DeviceType.LIGHT)
                .available(true)
                .build();
        availableDevice.id = 1L;

        unavailableDevice = Device.builder()
                .ieeeAddress("AA:BB:CC:DD:EE:FF")
                .friendlyName("broken_sensor")
                .type(DeviceType.SENSOR)
                .available(false)
                .build();
        unavailableDevice.id = 2L;
    }

    @Test
    void testSetState_returns202() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));
        when(commandService.setState(eq("living_room_light"), eq("ON")))
                .thenReturn(Uni.createFrom().voidItem());

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setState", "payload": {"state": "ON"}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(202);
    }

    @Test
    void testSetBrightness_returns202() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));
        when(commandService.setBrightness(eq("living_room_light"), eq(200)))
                .thenReturn(Uni.createFrom().voidItem());

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setBrightness", "payload": {"brightness": 200}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(202);
    }

    @Test
    void testSetColorTemp_returns202() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));
        when(commandService.setColorTemp(eq("living_room_light"), eq(370)))
                .thenReturn(Uni.createFrom().voidItem());

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setColorTemp", "payload": {"color_temp": 370}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(202);
    }

    @Test
    void testRawCommand_returns202() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));
        when(commandService.sendRawCommand(eq("living_room_light"), any()))
                .thenReturn(Uni.createFrom().voidItem());

        given()
                .contentType("application/json")
                .body("""
                        {"command": "raw", "payload": {"state": "ON", "brightness": 100}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(202);
    }

    @Test
    void testUnknownDevice_returns404() {
        when(deviceService.getDeviceById(99L))
                .thenReturn(Uni.createFrom().failure(new ResourceNotFoundException("Device", 99L)));

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setState", "payload": {"state": "ON"}}
                        """)
                .when().post("/api/devices/99/command")
                .then()
                .statusCode(404);
    }

    @Test
    void testUnavailableDevice_returns409() {
        when(deviceService.getDeviceById(2L)).thenReturn(Uni.createFrom().item(unavailableDevice));

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setState", "payload": {"state": "ON"}}
                        """)
                .when().post("/api/devices/2/command")
                .then()
                .statusCode(409)
                .body("title", is("Device Unavailable"));
    }

    @Test
    void testUnknownCommand_returns400() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));

        given()
                .contentType("application/json")
                .body("""
                        {"command": "launchRocket", "payload": {}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(400)
                .body("detail", containsString("launchRocket"));
    }

    @Test
    void testMissingPayloadField_returns400() {
        when(deviceService.getDeviceById(1L)).thenReturn(Uni.createFrom().item(availableDevice));

        given()
                .contentType("application/json")
                .body("""
                        {"command": "setState", "payload": {}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(400)
                .body("detail", containsString("state"));
    }

    @Test
    void testBlankCommand_returns400() {
        given()
                .contentType("application/json")
                .body("""
                        {"command": "", "payload": {"state": "ON"}}
                        """)
                .when().post("/api/devices/1/command")
                .then()
                .statusCode(400);
    }
}
