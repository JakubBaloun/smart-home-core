"""Mirror of NightModeRule."""

import logging

from app.automation.context import RuleContext
from app.automation.rule import Rule, RuleMetadata
from app.config import get_settings
from app.device.command_service import device_command_service

log = logging.getLogger(__name__)


class NightModeRule(Rule):
    metadata = RuleMetadata(name="night-mode", description="Turn off lights at midnight")

    def is_enabled(self) -> bool:
        return get_settings().automation.night_mode.enabled

    def applies_to(self, event_type: str) -> bool:
        return event_type == "schedule"

    def evaluate(self, context: RuleContext) -> None:
        lights = get_settings().automation.night_mode.lights
        if not lights:
            log.debug("Night mode triggered but no lights configured")
            return

        log.info("Night mode: turning off %s", lights)
        for light in lights:
            device_command_service.set_state(light, "OFF")
