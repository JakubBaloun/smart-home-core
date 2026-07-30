"""Mirror of RuleEngine."""

import logging

from app.automation.context import RuleContext
from app.automation.registry import rule_registry

log = logging.getLogger(__name__)


class RuleEngine:
    def fire(self, context: RuleContext) -> None:
        for rule in rule_registry.get_rules_for_event(context.event_type):
            try:
                rule.evaluate(context)
            except Exception:
                log.exception(
                    "Rule '%s' failed while handling event '%s'",
                    rule.metadata.name,
                    context.event_type,
                )


rule_engine = RuleEngine()
