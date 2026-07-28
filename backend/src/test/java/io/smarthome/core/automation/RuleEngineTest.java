package io.smarthome.core.automation;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class RuleEngineTest {

    @Inject
    RuleEngine ruleEngine;

    @BeforeEach
    void resetState() {
        RecordingAutomationRule.INVOCATIONS.clear();
        DisabledAutomationRule.INVOKED.set(false);
    }

    @Test
    void dispatchesToMatchingEnabledRules() {
        RuleContext context = RuleContext.builder()
                .eventType("test-event")
                .deviceId("dev-1")
                .data(Map.of("key", "value"))
                .build();

        ruleEngine.fire(context).await().indefinitely();

        assertEquals(1, RecordingAutomationRule.INVOCATIONS.size());
        assertEquals("dev-1", RecordingAutomationRule.INVOCATIONS.get(0).deviceId());
    }

    @Test
    void doesNotDispatchToDisabledRules() {
        RuleContext context = RuleContext.builder().eventType("test-event").build();

        ruleEngine.fire(context).await().indefinitely();

        assertFalse(DisabledAutomationRule.INVOKED.get());
    }

    @Test
    void oneFailingRuleDoesNotBlockOthers() {
        RuleContext context = RuleContext.builder().eventType("test-event").deviceId("dev-2").build();

        assertDoesNotThrow(() -> ruleEngine.fire(context).await().indefinitely());

        assertEquals(1, RecordingAutomationRule.INVOCATIONS.size());
    }

    @Test
    void ignoresEventsNoRuleAppliesTo() {
        RuleContext context = RuleContext.builder().eventType("no-such-event").build();

        ruleEngine.fire(context).await().indefinitely();

        assertTrue(RecordingAutomationRule.INVOCATIONS.isEmpty());
    }
}
