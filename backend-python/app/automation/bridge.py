"""Mirror of RuleEventBridge — turns domain events into rule contexts."""

import logging
from datetime import datetime, timezone

from app.automation.context import RuleContext
from app.automation.engine import rule_engine
from app.common.events import event_bus
from app.device.events import DevicesSyncedEvent
from app.telemetry.events import TelemetryReceivedEvent

log = logging.getLogger(__name__)


def on_devices_synced(event: DevicesSyncedEvent) -> None:
    _dispatch(
        RuleContext(
            event_type="devices-synced",
            data={
                "syncedIeeeAddresses": event.synced_ieee_addresses,
                "count": event.count,
            },
            timestamp=datetime.now(timezone.utc),
        )
    )


def on_telemetry_received(event: TelemetryReceivedEvent) -> None:
    _dispatch(
        RuleContext(
            event_type="telemetry-received",
            device_id=event.device_name,
            data=event.fields,
            timestamp=event.timestamp,
        )
    )


def _dispatch(context: RuleContext) -> None:
    try:
        rule_engine.fire(context)
    except Exception:
        log.exception("Unhandled failure dispatching rules for event '%s'", context.event_type)


def register() -> None:
    event_bus.subscribe(DevicesSyncedEvent, on_devices_synced)
    event_bus.subscribe(TelemetryReceivedEvent, on_telemetry_received)
