package io.smarthome.core.automation;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class RuleRegistryTest {

    @Inject
    RuleRegistry ruleRegistry;

    @Test
    void discoversAnnotatedRuleBeans() {
        var names = ruleRegistry.getRules().stream().map(r -> r.metadata().name()).toList();
        assertTrue(names.contains("test-recording-rule"));
        assertTrue(names.contains("test-failing-rule"));
        assertTrue(names.contains("test-disabled-rule"));
    }

    @Test
    void excludesDisabledRulesFromEnabledList() {
        var enabledNames = ruleRegistry.getEnabledRules().stream().map(r -> r.metadata().name()).toList();
        assertFalse(enabledNames.contains("test-disabled-rule"));
        assertTrue(enabledNames.contains("test-recording-rule"));
    }

    @Test
    void filtersRulesByAppliesTo() {
        var forEvent = ruleRegistry.getRulesForEvent("test-event").stream().map(r -> r.metadata().name()).toList();
        assertTrue(forEvent.contains("test-recording-rule"));
        assertTrue(forEvent.contains("test-failing-rule"));
        assertFalse(forEvent.contains("test-disabled-rule"));

        var forUnrelatedEvent = ruleRegistry.getRulesForEvent("unrelated-event");
        assertTrue(forUnrelatedEvent.stream().noneMatch(r -> r.metadata().name().equals("test-recording-rule")));
    }
}
