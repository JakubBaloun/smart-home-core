package io.smarthome.core.automation.rule;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.RuleContext;
import io.smarthome.core.device.service.DeviceCommandService;
import jakarta.enterprise.inject.Any;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@QuarkusTest
class DoorOpenedLightsRuleTest {

    private static final String DEVICE = "front_door_sensor";

    @Inject
    @Any
    DoorOpenedLightsRule rule;

    @InjectMock
    DeviceCommandService commandService;

    @BeforeEach
    void setup() {
        Mockito.reset(commandService);
        when(commandService.setState(anyString(), anyString())).thenReturn(Uni.createFrom().voidItem());
    }

    @Test
    void doorOpening_turnsOnHallwayLights() {
        rule.evaluate(contact(DEVICE, true)).await().indefinitely();
        rearmMock();

        rule.evaluate(contact(DEVICE, false)).await().indefinitely();

        verify(commandService).setState("hallway_light", "ON");
    }

    @Test
    void doorStayingOpen_doesNotRetrigger() {
        rule.evaluate(contact(DEVICE, false)).await().indefinitely();
        rearmMock();

        rule.evaluate(contact(DEVICE, false)).await().indefinitely();

        verifyNoInteractions(commandService);
    }

    @Test
    void otherDevices_areIgnored() {
        rule.evaluate(contact("some_other_sensor", true)).await().indefinitely();
        rule.evaluate(contact("some_other_sensor", false)).await().indefinitely();

        verifyNoInteractions(commandService);
    }

    @Test
    void missingContactField_isIgnored() {
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId(DEVICE).data(Map.of("temperature", 21.0)).build();

        rule.evaluate(context).await().indefinitely();

        verifyNoInteractions(commandService);
    }

    private void rearmMock() {
        Mockito.reset(commandService);
        when(commandService.setState(anyString(), anyString())).thenReturn(Uni.createFrom().voidItem());
    }

    private RuleContext contact(String deviceId, boolean closed) {
        return RuleContext.builder()
                .eventType("telemetry-received").deviceId(deviceId).data(Map.of("contact", closed)).build();
    }
}
