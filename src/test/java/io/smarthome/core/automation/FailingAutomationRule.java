package io.smarthome.core.automation;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
@AutomationRule(name = "test-failing-rule", description = "Test rule that always fails")
public class FailingAutomationRule implements Rule {

    @Override
    public boolean appliesTo(String eventType) {
        return "test-event".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        return Uni.createFrom().failure(new RuntimeException("boom"));
    }
}
