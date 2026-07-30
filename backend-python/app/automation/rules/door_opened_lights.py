"""Mirror of DoorOpenedLightsRule."""

import logging

from app.automation.context import RuleContext
from app.automation.rule import Rule, RuleMetadata
from app.config import get_settings
from app.device.command_service import device_command_service

log = logging.getLogger(__name__)

CONTACT_FIELD = "contact"


class DoorOpenedLightsRule(Rule):
    metadata = RuleMetadata(
        name="door-opened-lights", description="Turn on lights when the door opens"
    )

    def __init__(self) -> None:
        self._previous_state: dict[str, object] = {}

    def is_enabled(self) -> bool:
        return get_settings().automation.door_opened_lights.enabled

    def applies_to(self, event_type: str) -> bool:
        return event_type == "telemetry-received"

    def evaluate(self, context: RuleContext) -> None:
        config = get_settings().automation.door_opened_lights
        if config.door_sensor != context.device_id:
            return

        contact_closed = context.data.get(CONTACT_FIELD)
        if not isinstance(contact_closed, bool):
            return

        previously_closed = self._previous_state.get(context.device_id)
        self._previous_state[context.device_id] = contact_closed

        if previously_closed is True and not contact_closed:
            log.info("Door '%s' opened, turning on %s", context.device_id, config.lights)
            for light in config.lights:
                device_command_service.set_state(light, "ON")
