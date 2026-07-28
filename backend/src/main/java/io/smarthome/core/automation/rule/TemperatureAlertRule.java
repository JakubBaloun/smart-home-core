package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.AutomationConfig;
import io.smarthome.core.automation.AutomationRule;
import io.smarthome.core.automation.RuleContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
@AutomationRule(name = "temperature-alert", description = "Alert when temperature exceeds threshold")
public class TemperatureAlertRule extends AbstractThresholdRule {

    @Inject
    AutomationConfig config;

    @Override
    public boolean isEnabled() {
        return config.temperatureAlert().enabled();
    }

    @Override
    protected String getDeviceId() {
        return config.temperatureAlert().device().orElse(null);
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
        return config.temperatureAlert().threshold();
    }

    @Override
    protected Uni<Void> onThresholdCrossed(RuleContext context, double value) {
        Log.warnf("Temperature alert: device '%s' reported %.1f°C (limit %.1f°C)",
                context.deviceId(), value, getThreshold());
        return Uni.createFrom().voidItem();
    }
}
