package io.smarthome.core.automation;

import io.quarkus.logging.Log;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.spi.CreationalContext;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Any;
import jakarta.enterprise.inject.spi.Bean;
import jakarta.enterprise.inject.spi.BeanManager;
import jakarta.inject.Inject;

import java.lang.annotation.Annotation;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@ApplicationScoped
public class RuleRegistry {

    public record RegisteredRule(Rule rule, AutomationRule metadata) {}

    @Inject
    BeanManager beanManager;

    private final List<RegisteredRule> rules = new ArrayList<>();

    void onStart(@Observes StartupEvent event) {
        for (Bean<?> bean : beanManager.getBeans(Rule.class, Any.Literal.INSTANCE)) {
            AutomationRule metadata = findMetadata(bean);
            if (metadata == null) {
                continue;
            }
            CreationalContext<?> ctx = beanManager.createCreationalContext(bean);
            Rule rule = (Rule) beanManager.getReference(bean, Rule.class, ctx);
            rules.add(new RegisteredRule(rule, metadata));
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
        return rules.stream().filter(r -> r.metadata().enabled()).toList();
    }

    public List<RegisteredRule> getRulesForEvent(String eventType) {
        return getEnabledRules().stream()
                .filter(r -> r.rule().appliesTo(eventType))
                .toList();
    }
}
