"""Mirror of AbstractThresholdRule."""

import logging
from enum import Enum

from app.automation.context import RuleContext
from app.automation.rule import Rule

log = logging.getLogger(__name__)


class Operator(str, Enum):
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN = "LESS_THAN"
    EQUAL = "EQUAL"


class AbstractThresholdRule(Rule):
    def get_device_id(self) -> str | None:
        raise NotImplementedError

    def get_field(self) -> str:
        raise NotImplementedError

    def get_operator(self) -> Operator:
        raise NotImplementedError

    def get_threshold(self) -> float:
        raise NotImplementedError

    def on_threshold_crossed(self, context: RuleContext, value: float) -> None:
        raise NotImplementedError

    def applies_to(self, event_type: str) -> bool:
        return event_type == "telemetry-received"

    def evaluate(self, context: RuleContext) -> None:
        device_id = self.get_device_id()
        if device_id is not None and device_id != context.device_id:
            return

        raw = context.data.get(self.get_field())
        # Java's `instanceof Number` excludes Boolean; Python's bool is an int.
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            return

        value = float(raw)
        if not self._crosses_threshold(value):
            return

        log.info(
            "Threshold crossed for device '%s' field '%s': value=%s threshold=%s",
            context.device_id,
            self.get_field(),
            value,
            self.get_threshold(),
        )
        self.on_threshold_crossed(context, value)

    def _crosses_threshold(self, value: float) -> bool:
        operator = self.get_operator()
        threshold = self.get_threshold()
        if operator is Operator.GREATER_THAN:
            return value > threshold
        if operator is Operator.LESS_THAN:
            return value < threshold
        return value == threshold
