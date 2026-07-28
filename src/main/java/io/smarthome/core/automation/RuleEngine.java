package io.smarthome.core.automation;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class RuleEngine {

    @Inject
    RuleRegistry ruleRegistry;

    public Uni<Void> fire(RuleContext context) {
        var matching = ruleRegistry.getRulesForEvent(context.eventType());

        if (matching.isEmpty()) {
            return Uni.createFrom().voidItem();
        }

        return Multi.createFrom().iterable(matching)
                .onItem().transformToUniAndConcatenate(registered -> evaluateSafely(registered, context))
                .collect().last()
                .replaceWithVoid();
    }

    private Uni<Void> evaluateSafely(RuleRegistry.RegisteredRule registered, RuleContext context) {
        return registered.rule().evaluate(context)
                .onFailure().invoke(e -> Log.errorf(e, "Rule '%s' failed while handling event '%s'",
                        registered.metadata().name(), context.eventType()))
                .onFailure().recoverWithNull()
                .replaceWithVoid();
    }
}
