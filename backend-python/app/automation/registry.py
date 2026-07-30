"""Mirror of RuleRegistry.

CDI discovery is replaced by an explicit list; the sort by rule name and the
enabled/appliesTo filtering are unchanged.
"""

import logging

from app.automation.rule import Rule
from app.automation.rules.door_opened_lights import DoorOpenedLightsRule
from app.automation.rules.night_mode import NightModeRule
from app.automation.rules.temperature_alert import TemperatureAlertRule

log = logging.getLogger(__name__)


class RuleRegistry:
    def __init__(self) -> None:
        self._rules: list[Rule] = []

    def start(self) -> None:
        self._rules = sorted(
            [NightModeRule(), DoorOpenedLightsRule(), TemperatureAlertRule()],
            key=lambda r: r.metadata.name,
        )
        log.info(
            "Discovered %d automation rule(s): %s",
            len(self._rules),
            [r.metadata.name for r in self._rules],
        )

    def get_rules(self) -> list[Rule]:
        return list(self._rules)

    def get_enabled_rules(self) -> list[Rule]:
        return [r for r in self._rules if r.metadata.enabled and r.is_enabled()]

    def get_rules_for_event(self, event_type: str) -> list[Rule]:
        return [r for r in self.get_enabled_rules() if r.applies_to(event_type)]


rule_registry = RuleRegistry()
