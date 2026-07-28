package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.AutomationRule;
import io.smarthome.core.automation.Rule;
import io.smarthome.core.automation.RuleContext;
import io.smarthome.core.automation.RuleEngine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.Map;

@ApplicationScoped
@AutomationRule(name = "night-mode", description = "Turn off lights at midnight")
public class NightModeRule implements Rule {

    @Inject
    RuleEngine ruleEngine;

    @Scheduled(cron = "0 0 0 * * ?", timeZone = "Europe/Prague")
    void trigger() {
        RuleContext context = RuleContext.builder()
                .eventType("schedule")
                .deviceId("night-mode")
                .data(Map.of())
                .timestamp(Instant.now())
                .build();

        ruleEngine.fire(context)
                .subscribe().with(
                        ignored -> {},
                        failure -> Log.errorf(failure, "Night mode schedule dispatch failed")
                );
    }

    @Override
    public boolean appliesTo(String eventType) {
        return "schedule".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        Log.info("Night mode triggered: turning off lights");
        return Uni.createFrom().voidItem();
    }
}
