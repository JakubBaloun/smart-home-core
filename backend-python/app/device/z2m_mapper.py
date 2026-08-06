"""Mirror of Z2MDeviceMapper (MapStruct)."""

from datetime import datetime, timezone

from app.device.models import Device, DeviceType
from app.device.schemas import Z2MDevicePayload


def resolve_vendor(payload: Z2MDevicePayload) -> str | None:
    """Z2M nests vendor/model under 'definition'; top-level fields are a legacy fallback."""
    if payload.definition is not None and payload.definition.vendor is not None:
        return payload.definition.vendor
    return payload.vendor


def resolve_model(payload: Z2MDevicePayload) -> str | None:
    if payload.definition is not None and payload.definition.model is not None:
        return payload.definition.model
    return payload.model


def determine_type(payload: Z2MDevicePayload) -> DeviceType:
    if payload.definition is None or payload.definition.description is None:
        return DeviceType.OTHER

    desc = payload.definition.description.lower()

    if "light" in desc or "bulb" in desc or "led" in desc:
        return DeviceType.LIGHT
    if "sensor" in desc or "motion" in desc or "occupancy" in desc or "temperature" in desc:
        return DeviceType.SENSOR
    if "switch" in desc or "button" in desc:
        return DeviceType.SWITCH
    return DeviceType.OTHER


def to_entity(payload: Z2MDevicePayload) -> Device:
    return Device(
        ieee_address=payload.ieee_address,
        friendly_name=payload.friendly_name,
        type=determine_type(payload).value,
        vendor=resolve_vendor(payload),
        model=resolve_model(payload),
        available=True,
        last_seen=datetime.now(timezone.utc),
        exposes=payload.exposes,
    )


def update_entity_from_payload(payload: Z2MDevicePayload, device: Device) -> None:
    # availability/lastSeen are owned by the zigbee2mqtt/+/availability topic,
    # not by device sync — do not touch them here.
    device.friendly_name = payload.friendly_name
    device.type = determine_type(payload).value
    device.vendor = resolve_vendor(payload)
    device.model = resolve_model(payload)
    device.exposes = payload.exposes
    device.updated_at = datetime.now(timezone.utc)
