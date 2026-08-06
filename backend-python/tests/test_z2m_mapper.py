"""Mirror of Z2MDeviceMapperTest."""

import pytest

from app.device import z2m_mapper
from app.device.models import Device, DeviceType
from app.device.schemas import Z2MDevicePayload


def payload(description: str | None = None, **kwargs) -> Z2MDevicePayload:
    data = {
        "ieee_address": "00:11:22:33:44:55",
        "friendly_name": "device",
        "type": "EndDevice",
    }
    data.update(kwargs)
    if description is not None:
        data.setdefault("definition", {})
        data["definition"] = {**data["definition"], "description": description}
    return Z2MDevicePayload.model_validate(data)


@pytest.mark.parametrize(
    "description,expected",
    [
        ("Hue white and color ambiance light", DeviceType.LIGHT),
        ("Smart bulb E27", DeviceType.LIGHT),
        ("LED strip controller", DeviceType.LIGHT),
        ("Motion sensor", DeviceType.SENSOR),
        ("Occupancy detector", DeviceType.SENSOR),
        ("Temperature and humidity meter", DeviceType.SENSOR),
        ("Wall switch", DeviceType.SWITCH),
        ("Wireless button", DeviceType.SWITCH),
        ("Curtain motor", DeviceType.OTHER),
    ],
)
def test_determine_type_from_description(description, expected):
    assert z2m_mapper.determine_type(payload(description)) is expected


def test_determine_type_without_definition_is_other():
    assert z2m_mapper.determine_type(payload()) is DeviceType.OTHER


def test_definition_wins_over_top_level_vendor_and_model():
    p = payload(
        "Motion sensor",
        vendor="LegacyVendor",
        model="LegacyModel",
        definition={"vendor": "Aqara", "model": "RTCGQ11LM"},
    )
    assert z2m_mapper.resolve_vendor(p) == "Aqara"
    assert z2m_mapper.resolve_model(p) == "RTCGQ11LM"


def test_top_level_vendor_and_model_used_as_fallback():
    p = payload(vendor="LegacyVendor", model="LegacyModel")
    assert z2m_mapper.resolve_vendor(p) == "LegacyVendor"
    assert z2m_mapper.resolve_model(p) == "LegacyModel"


def test_to_entity_marks_device_available():
    entity = z2m_mapper.to_entity(payload("Motion sensor"))
    assert entity.available is True
    assert entity.last_seen is not None
    assert entity.type == DeviceType.SENSOR.value


def test_update_entity_does_not_touch_availability():
    existing = Device(
        ieee_address="00:11:22:33:44:55",
        friendly_name="Old",
        type=DeviceType.OTHER.value,
        available=False,
        last_seen=None,
    )

    z2m_mapper.update_entity_from_payload(
        payload("Hue white light", friendly_name="New"), existing
    )

    assert existing.friendly_name == "New"
    assert existing.type == DeviceType.LIGHT.value
    assert existing.available is False
    assert existing.last_seen is None
    assert existing.ieee_address == "00:11:22:33:44:55"


RGB_BULB_EXPOSES = [
    {
        "type": "light",
        "features": [
            {"name": "brightness", "type": "numeric", "value_min": 0, "value_max": 254},
            {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
            {
                "type": "composite",
                "name": "color_hs",
                "features": [
                    {"name": "hue", "type": "numeric", "value_min": 0, "value_max": 360},
                    {"name": "saturation", "type": "numeric", "value_min": 0, "value_max": 100},
                ],
            },
        ],
    }
]


def test_to_entity_persists_exposes_verbatim():
    entity = z2m_mapper.to_entity(payload("Hue color bulb", exposes=RGB_BULB_EXPOSES))
    assert entity.exposes == RGB_BULB_EXPOSES


def test_update_entity_from_payload_overwrites_exposes():
    existing = Device(
        ieee_address="00:11:22:33:44:55",
        friendly_name="old",
        type=DeviceType.LIGHT.value,
        available=True,
        exposes=[{"stale": True}],
    )
    z2m_mapper.update_entity_from_payload(
        payload("Hue color bulb", friendly_name="new", exposes=RGB_BULB_EXPOSES), existing
    )
    assert existing.exposes == RGB_BULB_EXPOSES


def test_to_entity_without_exposes_leaves_column_null():
    entity = z2m_mapper.to_entity(payload("Motion sensor"))
    assert entity.exposes is None
