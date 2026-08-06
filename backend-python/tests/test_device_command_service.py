"""Unit-tests for DeviceCommandService.set_color — mirrors the wire shape
that the existing set_brightness/set_color_temp tests assert in test_device_api.py."""

import pytest

from app.device.command_service import device_command_service


@pytest.fixture
def published(monkeypatch) -> list[tuple[str, bytes]]:
    sent: list[tuple[str, bytes]] = []
    monkeypatch.setattr(
        "app.mqtt.publisher.mqtt_publisher.publish",
        lambda topic, payload, qos=1, retain=False: sent.append((topic, payload)),
    )
    return sent


def test_set_color_publishes_hue_and_saturation(published):
    device_command_service.set_color("living_room_light", 200, 80)
    assert published == [
        ("zigbee2mqtt/living_room_light/set", b'{"color":{"hue":200,"saturation":80}}')
    ]


def test_set_color_uses_compact_json(published):
    device_command_service.set_color("bulb", 0, 0)
    _, body = published[0]
    assert b" " not in body
