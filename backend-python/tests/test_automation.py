"""Mirror of RuleEngineTest, RuleRegistryTest, RuleEventBridgeTest and the rule tests."""

from datetime import datetime, timezone

import pytest

from app.automation import bridge
from app.automation.context import RuleContext
from app.automation.engine import RuleEngine
from app.automation.registry import RuleRegistry, rule_registry
from app.automation.rule import Rule, RuleMetadata
from app.automation.rules.base import AbstractThresholdRule, Operator
from app.automation.rules.door_opened_lights import DoorOpenedLightsRule
from app.automation.rules.night_mode import NightModeRule
from app.automation.rules.temperature_alert import TemperatureAlertRule
from app.common.events import event_bus
from app.config import get_settings
from app.device.events import DevicesSyncedEvent
from app.telemetry.events import TelemetryReceivedEvent


class RecordingRule(Rule):
    metadata = RuleMetadata(name="recording")

    def __init__(self) -> None:
        self.contexts: list[RuleContext] = []

    def evaluate(self, context: RuleContext) -> None:
        self.contexts.append(context)


class FailingRule(Rule):
    metadata = RuleMetadata(name="failing")

    def evaluate(self, context: RuleContext) -> None:
        raise RuntimeError("boom")


class DisabledRule(Rule):
    metadata = RuleMetadata(name="disabled", enabled=False)

    def evaluate(self, context: RuleContext) -> None:
        raise AssertionError("disabled rule must not run")


class ScheduleOnlyRule(Rule):
    metadata = RuleMetadata(name="schedule-only")

    def __init__(self) -> None:
        self.calls = 0

    def applies_to(self, event_type: str) -> bool:
        return event_type == "schedule"

    def evaluate(self, context: RuleContext) -> None:
        self.calls += 1


@pytest.fixture
def commands(monkeypatch) -> list[tuple[str, str]]:
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.device.command_service.device_command_service.set_state",
        lambda name, state: sent.append((name, state)),
    )
    return sent


def registry_with(*rules) -> RuleRegistry:
    registry = RuleRegistry()
    registry._rules = sorted(rules, key=lambda r: r.metadata.name)
    return registry


def fire(registry: RuleRegistry, context: RuleContext) -> None:
    engine = RuleEngine()
    import app.automation.engine as engine_module

    original = engine_module.rule_registry
    engine_module.rule_registry = registry
    try:
        engine.fire(context)
    finally:
        engine_module.rule_registry = original


def test_engine_runs_matching_rules():
    recording = RecordingRule()
    registry = registry_with(recording)

    fire(registry, RuleContext(event_type="telemetry-received", device_id="sensor"))

    assert len(recording.contexts) == 1
    assert recording.contexts[0].device_id == "sensor"


def test_engine_isolates_rule_failures():
    recording = RecordingRule()
    registry = registry_with(FailingRule(), recording)

    fire(registry, RuleContext(event_type="telemetry-received"))

    assert len(recording.contexts) == 1


def test_engine_skips_disabled_and_non_matching_rules():
    schedule_only = ScheduleOnlyRule()
    registry = registry_with(DisabledRule(), schedule_only)

    fire(registry, RuleContext(event_type="telemetry-received"))
    assert schedule_only.calls == 0

    fire(registry, RuleContext(event_type="schedule"))
    assert schedule_only.calls == 1


def test_registry_discovers_rules_sorted_by_name():
    registry = RuleRegistry()
    registry.start()
    assert [r.metadata.name for r in registry.get_rules()] == [
        "door-opened-lights",
        "night-mode",
        "temperature-alert",
    ]


def test_bridge_maps_events_to_contexts(monkeypatch):
    contexts: list[RuleContext] = []
    monkeypatch.setattr(
        "app.automation.bridge.rule_engine.fire", lambda context: contexts.append(context)
    )
    bridge.register()

    event_bus.publish(DevicesSyncedEvent(["AA"], 1))
    event_bus.publish(
        TelemetryReceivedEvent("sensor", {"temperature": 25.0}, datetime.now(timezone.utc))
    )

    assert contexts[0].event_type == "devices-synced"
    assert contexts[0].data == {"syncedIeeeAddresses": ["AA"], "count": 1}
    assert contexts[1].event_type == "telemetry-received"
    assert contexts[1].device_id == "sensor"
    assert contexts[1].data == {"temperature": 25.0}


class SampleThresholdRule(AbstractThresholdRule):
    metadata = RuleMetadata(name="sample-threshold")

    def __init__(self, device_id: str | None, operator: Operator, threshold: float) -> None:
        self._device_id = device_id
        self._operator = operator
        self._threshold = threshold
        self.crossed: list[float] = []

    def get_device_id(self):
        return self._device_id

    def get_field(self) -> str:
        return "temperature"

    def get_operator(self) -> Operator:
        return self._operator

    def get_threshold(self) -> float:
        return self._threshold

    def on_threshold_crossed(self, context: RuleContext, value: float) -> None:
        self.crossed.append(value)


def telemetry(device_id: str, **data) -> RuleContext:
    return RuleContext(event_type="telemetry-received", device_id=device_id, data=data)


def test_threshold_rule_applies_only_to_telemetry():
    rule = SampleThresholdRule(None, Operator.GREATER_THAN, 30.0)
    assert rule.applies_to("telemetry-received") is True
    assert rule.applies_to("schedule") is False


def test_threshold_rule_fires_above_threshold():
    rule = SampleThresholdRule(None, Operator.GREATER_THAN, 30.0)
    rule.evaluate(telemetry("sensor", temperature=31.0))
    assert rule.crossed == [31.0]


def test_threshold_rule_ignores_other_devices():
    rule = SampleThresholdRule("watched", Operator.GREATER_THAN, 30.0)
    rule.evaluate(telemetry("other", temperature=99.0))
    assert rule.crossed == []


def test_threshold_rule_ignores_non_numeric_and_boolean_values():
    rule = SampleThresholdRule(None, Operator.GREATER_THAN, 0.0)
    rule.evaluate(telemetry("sensor", temperature="hot"))
    rule.evaluate(telemetry("sensor", temperature=True))
    assert rule.crossed == []


def test_threshold_rule_less_than_and_equal():
    less = SampleThresholdRule(None, Operator.LESS_THAN, 5.0)
    less.evaluate(telemetry("sensor", temperature=4.0))
    assert less.crossed == [4.0]

    equal = SampleThresholdRule(None, Operator.EQUAL, 5.0)
    equal.evaluate(telemetry("sensor", temperature=5.0))
    assert equal.crossed == [5.0]


def test_temperature_alert_uses_configured_threshold():
    rule = TemperatureAlertRule()
    settings = get_settings()
    assert rule.get_threshold() == settings.automation.temperature_alert.threshold
    assert rule.get_device_id() == settings.automation.temperature_alert.device
    assert rule.get_field() == "temperature"
    assert rule.get_operator() is Operator.GREATER_THAN
    # watches every device when no device is configured
    rule.evaluate(telemetry("any_sensor", temperature=99.0))


def test_door_opened_lights_turns_lights_on_when_contact_opens(commands):
    rule = DoorOpenedLightsRule()
    sensor = get_settings().automation.door_opened_lights.door_sensor

    rule.evaluate(telemetry(sensor, contact=True))
    assert commands == []

    rule.evaluate(telemetry(sensor, contact=False))
    assert commands == [(light, "ON") for light in get_settings().automation.door_opened_lights.lights]


def test_door_opened_lights_ignores_first_open_without_previous_state(commands):
    rule = DoorOpenedLightsRule()
    sensor = get_settings().automation.door_opened_lights.door_sensor

    rule.evaluate(telemetry(sensor, contact=False))
    assert commands == []


def test_door_opened_lights_ignores_other_devices(commands):
    rule = DoorOpenedLightsRule()
    rule.evaluate(telemetry("other_sensor", contact=True))
    rule.evaluate(telemetry("other_sensor", contact=False))
    assert commands == []


def test_night_mode_applies_only_to_schedule():
    rule = NightModeRule()
    assert rule.applies_to("schedule") is True
    assert rule.applies_to("telemetry-received") is False


def test_night_mode_without_configured_lights_does_nothing(commands):
    rule = NightModeRule()
    rule.evaluate(RuleContext(event_type="schedule", device_id="night-mode"))
    assert commands == []


def test_night_mode_turns_configured_lights_off(commands, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings.automation.night_mode, "lights", ["hallway_light", "lamp"])

    NightModeRule().evaluate(RuleContext(event_type="schedule", device_id="night-mode"))

    assert commands == [("hallway_light", "OFF"), ("lamp", "OFF")]


def test_registered_rules_are_the_configured_ones():
    rule_registry.start()
    names = [r.metadata.name for r in rule_registry.get_enabled_rules()]
    assert "night-mode" in names
    assert "door-opened-lights" in names
    assert "temperature-alert" in names
