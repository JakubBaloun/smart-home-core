package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.Rule;
import io.smarthome.core.automation.RuleContext;

public abstract class AbstractThresholdRule implements Rule {

    public enum Operator {
        GREATER_THAN, LESS_THAN, EQUAL
    }

    protected abstract String getDeviceId();

    protected abstract String getField();

    protected abstract Operator getOperator();

    protected abstract double getThreshold();

    protected abstract Uni<Void> onThresholdCrossed(RuleContext context, double value);

    @Override
    public boolean appliesTo(String eventType) {
        return "telemetry-received".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        if (getDeviceId() != null && !getDeviceId().equals(context.deviceId())) {
            return Uni.createFrom().voidItem();
        }

        Object raw = context.data().get(getField());
        if (!(raw instanceof Number number)) {
            return Uni.createFrom().voidItem();
        }

        double value = number.doubleValue();
        if (!crossesThreshold(value)) {
            return Uni.createFrom().voidItem();
        }

        Log.infof("Threshold crossed for device '%s' field '%s': value=%s threshold=%s",
                context.deviceId(), getField(), value, getThreshold());
        return onThresholdCrossed(context, value);
    }

    private boolean crossesThreshold(double value) {
        return switch (getOperator()) {
            case GREATER_THAN -> value > getThreshold();
            case LESS_THAN -> value < getThreshold();
            case EQUAL -> value == getThreshold();
        };
    }
}
