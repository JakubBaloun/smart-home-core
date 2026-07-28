package io.smarthome.core.automation;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.device.event.DevicesSyncedEvent;
import io.smarthome.core.telemetry.event.TelemetryReceivedEvent;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
class RuleEventBridgeTest {

    @Inject
    Event<DevicesSyncedEvent> devicesSyncedEventBus;

    @Inject
    Event<TelemetryReceivedEvent> telemetryEventBus;

    @InjectMock
    RuleEngine ruleEngine;

    @Test
    void devicesSyncedEventIsTranslatedToRuleContext() {
        when(ruleEngine.fire(any())).thenReturn(Uni.createFrom().voidItem());

        devicesSyncedEventBus.fire(new DevicesSyncedEvent(List.of("00:11"), 1));

        ArgumentCaptor<RuleContext> captor = ArgumentCaptor.forClass(RuleContext.class);
        verify(ruleEngine).fire(captor.capture());
        assertEquals("devices-synced", captor.getValue().eventType());
        assertEquals(1, captor.getValue().data().get("count"));
    }

    @Test
    void telemetryReceivedEventIsTranslatedToRuleContext() {
        when(ruleEngine.fire(any())).thenReturn(Uni.createFrom().voidItem());

        telemetryEventBus.fire(new TelemetryReceivedEvent("sensor-1", Map.of("temperature", 22.5), Instant.now()));

        ArgumentCaptor<RuleContext> captor = ArgumentCaptor.forClass(RuleContext.class);
        verify(ruleEngine).fire(captor.capture());
        assertEquals("telemetry-received", captor.getValue().eventType());
        assertEquals("sensor-1", captor.getValue().deviceId());
        assertEquals(22.5, captor.getValue().data().get("temperature"));
    }
}
