package io.smarthome.core.automation.rule;

import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.automation.AutomationConfig;
import io.smarthome.core.automation.AutomationRule;
import io.smarthome.core.automation.Rule;
import io.smarthome.core.automation.RuleContext;
import io.smarthome.core.automation.RuleEngine;
import io.smarthome.core.device.service.DeviceCommandService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@ApplicationScoped
@AutomationRule(name = "night-mode", description = "Turn off lights at midnight")
public class NightModeRule implements Rule {

    @Inject
    AutomationConfig config;

    @Inject
    RuleEngine ruleEngine;

    @Inject
    DeviceCommandService commandService;

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
    public boolean isEnabled() {
        return config.nightMode().enabled();
    }

    @Override
    public boolean appliesTo(String eventType) {
        return "schedule".equals(eventType);
    }

    @Override
    public Uni<Void> evaluate(RuleContext context) {
        List<String> lights = config.nightMode().lights().orElse(List.of());
        if (lights.isEmpty()) {
            Log.debug("Night mode triggered but no lights configured");
            return Uni.createFrom().voidItem();
        }

        Log.infof("Night mode: turning off %s", lights);
        return Multi.createFrom().iterable(lights)
                .onItem().transformToUniAndConcatenate(light -> commandService.setState(light, "OFF"))
                .collect().last()
                .replaceWithVoid();
    }
}
