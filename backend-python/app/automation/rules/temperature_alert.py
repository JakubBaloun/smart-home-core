"""Mirror of TemperatureAlertRule."""

import logging

from app.automation.context import RuleContext
from app.automation.rule import RuleMetadata
from app.automation.rules.base import AbstractThresholdRule, Operator
from app.config import get_settings

log = logging.getLogger(__name__)


class TemperatureAlertRule(AbstractThresholdRule):
    metadata = RuleMetadata(
        name="temperature-alert", description="Alert when temperature exceeds threshold"
    )

    def is_enabled(self) -> bool:
        return get_settings().automation.temperature_alert.enabled

    def get_device_id(self) -> str | None:
        return get_settings().automation.temperature_alert.device

    def get_field(self) -> str:
        return "temperature"

    def get_operator(self) -> Operator:
        return Operator.GREATER_THAN

    def get_threshold(self) -> float:
        return get_settings().automation.temperature_alert.threshold

    def on_threshold_crossed(self, context: RuleContext, value: float) -> None:
        log.warning(
            "Temperature alert: device '%s' reported %.1f°C (limit %.1f°C)",
            context.device_id,
            value,
            self.get_threshold(),
        )
