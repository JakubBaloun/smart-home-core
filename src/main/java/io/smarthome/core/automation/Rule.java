package io.smarthome.core.automation;

import io.smallrye.mutiny.Uni;

public interface Rule {

    Uni<Void> evaluate(RuleContext context);

    default boolean appliesTo(String eventType) {
        return true;
    }
}
