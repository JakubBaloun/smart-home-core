"""Mirrors of DeviceDiscoveryConsumer, TelemetryConsumer, DeviceAvailabilityConsumer
and BridgeStateConsumer. Each consumer swallows its own failures, matching the
`failure-strategy: ignore` on every incoming channel."""

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.common.events import event_bus
from app.device.schemas import Z2MDevicePayload
from app.device.service import device_service
from app.mqtt.bridge_state import bridge_state_holder
from app.mqtt.state_payload import is_online
from app.telemetry.events import TelemetryReceivedEvent
from app.telemetry.fields import KNOWN_FIELDS
from app.telemetry.service import telemetry_service

log = logging.getLogger(__name__)

TOPIC_PREFIX = "zigbee2mqtt/"
AVAILABILITY_SUFFIX = "/availability"

# Topic names that matched no device, so their telemetry is still filed under
# the raw name. Tracked only to keep the warning to once per name.
_unregistered_names: set[str] = set()

_STATE_HISTORY_TYPES: frozenset[str] = frozenset({"LIGHT", "SWITCH", "PLUG"})


def _state_to_bool(value: Any) -> bool | None:
    if value == "ON":
        return True
    if value == "OFF":
        return False
    return None


def consume_devices(topic: str, payload: bytes) -> None:
    log.info("Received Z2M device discovery payload, beginning sync process")
    try:
        parsed = json.loads(payload.decode("utf-8"))
        dtos = [Z2MDevicePayload.model_validate(item) for item in parsed]
        device_service.sync_devices(dtos)
    except Exception as e:
        log.error("Failed to process Z2M device discovery: %s", e)


def _as_optional_int(value: Any) -> int | None:
    """Reject bools: Python's `bool` is an `int` subclass, but JSON `true`/`false`
    is not a brightness/color_temp reading."""
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def consume_telemetry(topic: str, payload: bytes) -> None:
    log.debug("TelemetryConsumer received message on topic: %s", topic)

    if "/bridge/" in topic:
        log.debug("Skipping bridge message on topic: %s", topic)
        return

    device_name = topic.replace(TOPIC_PREFIX, "")
    body = payload.decode("utf-8")

    try:
        parsed = json.loads(body)
    except ValueError as e:
        log.warning("Failed to parse telemetry payload from %s: %s", device_name, e)
        return
    if not isinstance(parsed, dict):
        log.warning("Telemetry payload from %s is not a JSON object, skipping", device_name)
        return

    # The topic carries a mutable label; the InfluxDB tag must be the immutable
    # identity, or a rename orphans every point written before it.
    identity = _identity_for(device_name)
    tag = identity.ieee_address if identity else device_name

    state = parsed.get("state")
    if isinstance(state, str) and identity is not None:
        try:
            device_service.update_state(identity.ieee_address, state)
        except Exception as e:
            log.error("Failed to update state for %s: %s", device_name, e)

    brightness = _as_optional_int(parsed.get("brightness"))
    color_temp = _as_optional_int(parsed.get("color_temp"))
    color = parsed.get("color") if isinstance(parsed.get("color"), dict) else None
    hue = _as_optional_int(color.get("hue")) if color else None
    saturation = _as_optional_int(color.get("saturation")) if color else None
    color_mode = parsed.get("color_mode") if isinstance(parsed.get("color_mode"), str) else None
    if identity is not None and any(
        v is not None for v in (brightness, color_temp, hue, saturation, color_mode)
    ):
        try:
            device_service.update_light_state(
                identity.ieee_address,
                brightness=brightness,
                color_temp=color_temp,
                hue=hue,
                saturation=saturation,
                color_mode=color_mode,
            )
        except Exception as e:
            log.error("Failed to update light state for %s: %s", device_name, e)

    # Convert "ON"/"OFF" to a boolean the telemetry pipeline will keep as-is.
    # normalize_fields() rejects non-numeric/non-boolean values, so the raw
    # string would otherwise be silently dropped. Only actuator types have
    # meaningful on/off state; a sensor's "state" (e.g. motion "occupied")
    # is a different concept and stays out of InfluxDB.
    fields_source: dict[str, Any] = dict(parsed)
    if identity is not None and identity.type in _STATE_HISTORY_TYPES:
        boolean_state = _state_to_bool(state)
        if boolean_state is not None:
            fields_source["state"] = boolean_state
        else:
            fields_source.pop("state", None)
    else:
        fields_source.pop("state", None)

    fields = {k: v for k, v in fields_source.items() if k in KNOWN_FIELDS}
    if not fields:
        log.debug("No known telemetry fields in message from %s, skipping", device_name)
        return
    # Rules are configured by device name, so the event keeps carrying a name —
    # the registry's, which is the one the user sees and configures against.
    rule_name = identity.friendly_name if identity else device_name

    try:
        telemetry_service.write_telemetry(tag, "sensor_data", fields)
    except Exception as e:
        log.error("Failed to write telemetry from %s (payload: %s): %s", device_name, body, e)
        return

    event_bus.publish(
        TelemetryReceivedEvent(rule_name, fields, datetime.now(timezone.utc))
    )


def _identity_for(device_name: str):
    """Resolve a topic name to a device, tolerating a registry that is down.

    A lookup failure must not cost us the reading, so an unresolvable name falls
    back to being tagged by name — the same thing that happened before this
    change, and still readable, because the query side falls back the same way.
    """
    try:
        identity = device_service.resolve_identity(device_name)
    except Exception as e:
        log.error("Could not resolve device for topic name '%s': %s", device_name, e)
        return None
    if identity is None:
        if device_name not in _unregistered_names:
            _unregistered_names.add(device_name)
            log.warning(
                "Telemetry from '%s' matches no registered device; filing it under that "
                "name until Z2M device discovery picks the device up",
                device_name,
            )
    else:
        _unregistered_names.discard(device_name)
    return identity


def consume_availability(topic: str, payload: bytes) -> None:
    if not topic.startswith(TOPIC_PREFIX) or not topic.endswith(AVAILABILITY_SUFFIX):
        return

    friendly_name = topic[len(TOPIC_PREFIX) : -len(AVAILABILITY_SUFFIX)]
    online = is_online(payload.decode("utf-8"))

    try:
        device_service.update_availability(friendly_name, online)
    except Exception as e:
        log.error("Failed to update availability of '%s': %s", friendly_name, e)


def consume_rename_response(topic: str, payload: bytes) -> None:
    """Outcome of a rename we asked Z2M for.

    Nothing is repaired here: on success the retained bridge/devices message
    that follows re-syncs the name anyway, and on failure the old name remains a
    resolvable alias so telemetry, availability and history are unaffected. The
    log is the only signal that the app's label and Z2M's topic have drifted.
    """
    try:
        parsed = json.loads(payload.decode("utf-8"))
    except ValueError as e:
        log.warning("Failed to parse Z2M rename response: %s", e)
        return
    if not isinstance(parsed, dict):
        return

    data = parsed.get("data") or {}
    if parsed.get("status") == "ok":
        log.info(
            "Z2M renamed device '%s' to '%s'", data.get("from"), data.get("to")
        )
    else:
        log.error(
            "Z2M refused to rename '%s' to '%s': %s. The app keeps the new label, "
            "Z2M keeps publishing under the old name; both names resolve to the "
            "same device, so no data is lost.",
            data.get("from"),
            data.get("to"),
            parsed.get("error", "unknown error"),
        )


def consume_bridge_state(topic: str, payload: bytes) -> None:
    try:
        online = is_online(payload.decode("utf-8"))
        bridge_state_holder.set_online(online)
        log.info("Zigbee2MQTT bridge is %s", "online" if online else "offline")
    except Exception as e:
        log.error("Failed to process bridge state: %s", e)
