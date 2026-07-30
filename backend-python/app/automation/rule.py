"""Mirror of the Rule interface and the @AutomationRule qualifier."""

from dataclasses import dataclass

from app.automation.context import RuleContext


@dataclass(frozen=True)
class RuleMetadata:
    name: str
    description: str = ""
    enabled: bool = True


class Rule:
    metadata: RuleMetadata

    def evaluate(self, context: RuleContext) -> None:
        raise NotImplementedError

    def applies_to(self, event_type: str) -> bool:
        return True

    def is_enabled(self) -> bool:
        """Runtime enablement (e.g. from configuration); combined with the
        metadata flag."""
        return True
