package io.smarthome.core.automation.rule;

import io.quarkus.test.junit.QuarkusTest;
import io.smarthome.core.automation.RuleContext;
import jakarta.enterprise.inject.Any;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class NightModeRuleTest {

    @Inject
    @Any
    NightModeRule rule;

    @Test
    void appliesOnlyToScheduleEvents() {
        assertTrue(rule.appliesTo("schedule"));
        assertFalse(rule.appliesTo("telemetry-received"));
    }

    @Test
    void manualTriggerEvaluatesWithoutError() {
        RuleContext context = RuleContext.builder().eventType("schedule").deviceId("night-mode").build();

        assertDoesNotThrow(() -> rule.evaluate(context).await().indefinitely());
    }
}
