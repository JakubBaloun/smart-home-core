"""Mirror of DeviceRepositoryTest and DeviceCommandServiceTest."""

import json

import pytest

from app.db import read_session, transaction
from app.device.command_service import device_command_service
from app.device.models import Device, DeviceType
from app.device.repository import device_repository


def save(ieee: str, name: str, available: bool = True) -> None:
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address=ieee,
                friendly_name=name,
                type=DeviceType.SENSOR.value,
                available=available,
            ),
            session,
        )


def find(ieee: str) -> Device:
    with read_session() as session:
        return device_repository.find_by_ieee_address(ieee, session)


def test_mark_unavailable_not_in_keeps_listed_devices():
    save("AA", "kept")
    save("BB", "dropped")

    with transaction() as session:
        device_repository.mark_unavailable_not_in(["AA"], session)

    assert find("AA").available is True
    assert find("BB").available is False


def test_mark_unavailable_not_in_marks_all_when_list_is_empty():
    save("AA", "one")
    save("BB", "two")

    with transaction() as session:
        device_repository.mark_unavailable_not_in([], session)

    assert find("AA").available is False
    assert find("BB").available is False


def test_update_availability_sets_last_seen_only_when_online():
    save("AA", "sensor", available=False)

    with transaction() as session:
        assert device_repository.update_availability("sensor", True, session) == 1
    device = find("AA")
    assert device.available is True
    assert device.last_seen is not None

    seen_at = device.last_seen
    with transaction() as session:
        device_repository.update_availability("sensor", False, session)
    device = find("AA")
    assert device.available is False
    assert device.last_seen == seen_at


def test_update_availability_of_unknown_device_updates_nothing():
    with transaction() as session:
        assert device_repository.update_availability("ghost", True, session) == 0


def test_find_by_type():
    save("AA", "sensor")
    with transaction() as session:
        device_repository.save(
            Device(ieee_address="BB", friendly_name="light", type=DeviceType.LIGHT.value),
            session,
        )

    with read_session() as session:
        lights = device_repository.find_by_type(DeviceType.LIGHT, session)
    assert [d.friendly_name for d in lights] == ["light"]


@pytest.fixture
def published(monkeypatch) -> list[tuple[str, bytes, int, bool]]:
    sent: list[tuple[str, bytes, int, bool]] = []
    monkeypatch.setattr(
        "app.mqtt.publisher.mqtt_publisher.publish",
        lambda topic, payload, qos=1, retain=False: sent.append((topic, payload, qos, retain)),
    )
    return sent


def test_command_service_publishes_compact_json(published):
    device_command_service.set_state("living_room_light", "on")
    device_command_service.set_brightness("living_room_light", 200)
    device_command_service.set_color_temp("living_room_light", 370)
    device_command_service.send_raw_command("living_room_light", {"effect": "blink"})

    topics = [c[0] for c in published]
    assert topics == ["zigbee2mqtt/living_room_light/set"] * 4
    assert json.loads(published[0][1]) == {"state": "ON"}
    assert json.loads(published[1][1]) == {"brightness": 200}
    assert json.loads(published[2][1]) == {"color_temp": 370}
    assert json.loads(published[3][1]) == {"effect": "blink"}
    assert published[0][2] == 1
    assert published[0][3] is False


def test_save_and_load_exposes_hue_saturation_round_trip():
    exposes = [
        {
            "type": "light",
            "features": [
                {"name": "brightness", "type": "numeric"},
                {"name": "color_temp", "type": "numeric", "value_min": 153, "value_max": 500},
                {
                    "type": "composite",
                    "name": "color_hs",
                    "features": [
                        {"name": "hue", "type": "numeric"},
                        {"name": "saturation", "type": "numeric"},
                    ],
                },
            ],
        }
    ]
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:AB",
                friendly_name="rgb_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
                exposes=exposes,
                hue=200,
                saturation=80,
            ),
            session,
        )

    with read_session() as session:
        loaded = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:AB", session)
    assert loaded.hue == 200
    assert loaded.saturation == 80
    assert loaded.exposes == exposes
