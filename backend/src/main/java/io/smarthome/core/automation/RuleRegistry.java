package io.smarthome.core.automation;

import io.quarkus.logging.Log;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.spi.Bean;
import jakarta.inject.Inject;

import java.lang.annotation.Annotation;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@ApplicationScoped
public class RuleRegistry {

    public record RegisteredRule(Rule rule, AutomationRule metadata) {}

    // Programmatic lookup via Instance keeps all Rule beans from being removed
    // by ArC's unused-bean elimination (a BeanManager lookup would not).
    @Inject
    @Any
    Instance<Rule> ruleInstances;

    private final List<RegisteredRule> rules = new ArrayList<>();

    void onStart(@Observes StartupEvent event) {
        for (Instance.Handle<Rule> handle : ruleInstances.handles()) {
            AutomationRule metadata = findMetadata(handle.getBean());
            if (metadata == null) {
                Log.warnf("Rule bean %s has no @AutomationRule annotation, skipping",
                        handle.getBean().getBeanClass().getSimpleName());
                continue;
            }
            rules.add(new RegisteredRule(handle.get(), metadata));
        }
        rules.sort(Comparator.comparing(r -> r.metadata().name()));
        Log.infof("Discovered %d automation rule(s): %s", rules.size(),
                rules.stream().map(r -> r.metadata().name()).toList());
    }

    private AutomationRule findMetadata(Bean<?> bean) {
        for (Annotation qualifier : bean.getQualifiers()) {
            if (qualifier instanceof AutomationRule automationRule) {
                return automationRule;
            }
        }
        return null;
    }

    public List<RegisteredRule> getRules() {
        return List.copyOf(rules);
    }

    public List<RegisteredRule> getEnabledRules() {
        return rules.stream()
                .filter(r -> r.metadata().enabled() && r.rule().isEnabled())
                .toList();
    }

    public List<RegisteredRule> getRulesForEvent(String eventType) {
        return getEnabledRules().stream()
                .filter(r -> r.rule().appliesTo(eventType))
                .toList();
    }
}
