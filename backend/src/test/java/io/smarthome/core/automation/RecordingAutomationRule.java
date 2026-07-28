package io.smarthome.core.automation;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@ApplicationScoped
@AutomationRule(name = "test-recording-rule", description = "Test rule that records invocations")
public class RecordingAutomationRule implements Rule {

    public static final List<RuleContext> INVOCATIONS = new CopyOnWriteArrayList<>();

    @Override
    public boolean appliesTo(String eventType) {
        return "test-event".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        INVOCATIONS.add(context);
        return Uni.createFrom().voidItem();
    }
}
