package io.smarthome.core.automation;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.concurrent.atomic.AtomicBoolean;

@ApplicationScoped
@AutomationRule(name = "test-disabled-rule", description = "Test rule that is disabled", enabled = false)
public class DisabledAutomationRule implements Rule {

    public static final AtomicBoolean INVOKED = new AtomicBoolean(false);

    @Override
    public boolean appliesTo(String eventType) {
        return "test-event".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        INVOKED.set(true);
        return Uni.createFrom().voidItem();
    }
}
