package io.smarthome.core.automation.rule;

import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.RuleContext;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AbstractThresholdRuleTest {

    private static class RecordingThresholdRule extends AbstractThresholdRule {
        final List<Double> crossedValues = new ArrayList<>();
        private final String deviceId;
        private final String field;
        private final Operator operator;
        private final double threshold;

        RecordingThresholdRule(String deviceId, String field, Operator operator, double threshold) {
            this.deviceId = deviceId;
            this.field = field;
            this.operator = operator;
            this.threshold = threshold;
        }

        @Override
        protected String getDeviceId() {
            return deviceId;
        }

        @Override
        protected String getField() {
            return field;
        }

        @Override
        protected Operator getOperator() {
            return operator;
        }

        @Override
        protected double getThreshold() {
            return threshold;
        }

        @Override
        protected Uni<Void> onThresholdCrossed(RuleContext context, double value) {
            crossedValues.add(value);
            return Uni.createFrom().voidItem();
        }
    }

    @Test
    void triggersWhenValueCrossesAboveThreshold() {
        var rule = new RecordingThresholdRule("dev-1", "temperature", AbstractThresholdRule.Operator.GREATER_THAN, 30.0);
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId("dev-1").data(Map.of("temperature", 35.0)).build();

        rule.evaluate(context).await().indefinitely();

        assertEquals(List.of(35.0), rule.crossedValues);
    }

    @Test
    void doesNotTriggerWhenWithinBounds() {
        var rule = new RecordingThresholdRule("dev-1", "temperature", AbstractThresholdRule.Operator.GREATER_THAN, 30.0);
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId("dev-1").data(Map.of("temperature", 20.0)).build();

        rule.evaluate(context).await().indefinitely();

        assertTrue(rule.crossedValues.isEmpty());
    }

    @Test
    void ignoresOtherDevicesWhenDeviceIdIsConfigured() {
        var rule = new RecordingThresholdRule("dev-1", "temperature", AbstractThresholdRule.Operator.GREATER_THAN, 30.0);
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId("dev-2").data(Map.of("temperature", 40.0)).build();

        rule.evaluate(context).await().indefinitely();

        assertTrue(rule.crossedValues.isEmpty());
    }

    @Test
    void supportsLessThanOperatorAndAnyDevice() {
        var rule = new RecordingThresholdRule(null, "battery", AbstractThresholdRule.Operator.LESS_THAN, 20.0);
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId("any-device").data(Map.of("battery", 10.0)).build();

        rule.evaluate(context).await().indefinitely();

        assertEquals(List.of(10.0), rule.crossedValues);
    }

    @Test
    void ignoresMissingOrNonNumericField() {
        var rule = new RecordingThresholdRule(null, "temperature", AbstractThresholdRule.Operator.GREATER_THAN, 30.0);
        RuleContext context = RuleContext.builder()
                .eventType("telemetry-received").deviceId("dev-1").data(Map.of("humidity", 50.0)).build();

        rule.evaluate(context).await().indefinitely();

        assertTrue(rule.crossedValues.isEmpty());
    }
}
