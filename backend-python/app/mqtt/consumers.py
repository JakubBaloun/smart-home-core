"""Mirrors of DeviceDiscoveryConsumer, TelemetryConsumer, DeviceAvailabilityConsumer
and BridgeStateConsumer. Each consumer swallows its own failures, matching the
`failure-strategy: ignore` on every incoming channel."""

import json
import logging
from datetime import datetime, timezone

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


def consume_devices(topic: str, payload: bytes) -> None:
    log.info("Received Z2M device discovery payload, beginning sync process")
    try:
        parsed = json.loads(payload.decode("utf-8"))
        dtos = [Z2MDevicePayload.model_validate(item) for item in parsed]
        device_service.sync_devices(dtos)
    except Exception as e:
        log.error("Failed to process Z2M device discovery: %s", e)


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

    fields = {k: v for k, v in parsed.items() if k in KNOWN_FIELDS}
    if not fields:
        log.debug("No known telemetry fields in message from %s, skipping", device_name)
        return

    try:
        telemetry_service.write_telemetry(device_name, "sensor_data", fields)
    except Exception as e:
        log.error("Failed to write telemetry from %s (payload: %s): %s", device_name, body, e)
        return

    event_bus.publish(
        TelemetryReceivedEvent(device_name, fields, datetime.now(timezone.utc))
    )


def consume_availability(topic: str, payload: bytes) -> None:
    if not topic.startswith(TOPIC_PREFIX) or not topic.endswith(AVAILABILITY_SUFFIX):
        return

    friendly_name = topic[len(TOPIC_PREFIX) : -len(AVAILABILITY_SUFFIX)]
    online = is_online(payload.decode("utf-8"))

    try:
        device_service.update_availability(friendly_name, online)
    except Exception as e:
        log.error("Failed to update availability of '%s': %s", friendly_name, e)


def consume_bridge_state(topic: str, payload: bytes) -> None:
    try:
        online = is_online(payload.decode("utf-8"))
        bridge_state_holder.set_online(online)
        log.info("Zigbee2MQTT bridge is %s", "online" if online else "offline")
    except Exception as e:
        log.error("Failed to process bridge state: %s", e)
