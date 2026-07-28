package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.AutomationRule;
import io.smarthome.core.automation.RuleContext;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
@AutomationRule(name = "temperature-alert", description = "Alert when temperature exceeds threshold")
public class TemperatureAlertRule extends AbstractThresholdRule {

    private static final double MAX_TEMPERATURE_CELSIUS = 30.0;

    @Override
    protected String getDeviceId() {
        return null;
    }

    @Override
    protected String getField() {
        return "temperature";
    }

    @Override
    protected Operator getOperator() {
        return Operator.GREATER_THAN;
    }

    @Override
    protected double getThreshold() {
        return MAX_TEMPERATURE_CELSIUS;
    }

    @Override
    protected Uni<Void> onThresholdCrossed(RuleContext context, double value) {
        Log.warnf("Temperature alert: device '%s' reported %.1f°C (limit %.1f°C)",
                context.deviceId(), value, MAX_TEMPERATURE_CELSIUS);
        return Uni.createFrom().voidItem();
    }
}
