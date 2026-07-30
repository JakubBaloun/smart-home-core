"""Mirror of DeviceDiscoveryConsumerTest and TelemetryConsumerTest."""

import json

import pytest

from app.db import read_session, transaction
from app.device.models import Device, DeviceType
from app.device.repository import device_repository
from app.mqtt import consumers
from app.mqtt.bridge_state import BridgeState, bridge_state_holder
from app.telemetry.service import telemetry_service

DISCOVERY_PAYLOAD = [
    {
        "ieee_address": "00:11:22:33:44:55:66:77",
        "friendly_name": "Living Room Light",
        "type": "EndDevice",
        "vendor": "Philips",
        "model": "9290012573A",
        "definition": {
            "description": "Hue white and color ambiance light",
            "model": "9290012573A",
            "vendor": "Philips",
        },
    },
    {
        "ieee_address": "AA:BB:CC:DD:EE:FF:00:11",
        "friendly_name": "Kitchen Sensor",
        "type": "EndDevice",
        "vendor": "Aqara",
        "model": "RTCGQ11LM",
        "definition": {
            "description": "Motion sensor",
            "model": "RTCGQ11LM",
            "vendor": "Aqara",
        },
    },
]


@pytest.fixture
def written(monkeypatch) -> list[tuple[str, str, dict]]:
    calls: list[tuple[str, str, dict]] = []
    monkeypatch.setattr(
        telemetry_service,
        "write_telemetry",
        lambda device, measurement, fields: calls.append((device, measurement, fields)),
    )
    return calls


def _devices() -> list[Device]:
    with read_session() as session:
        return device_repository.list_all(session)


def _encode(payload) -> bytes:
    return json.dumps(payload).encode("utf-8")


def test_consume_devices_valid_payload():
    consumers.consume_devices("zigbee2mqtt/bridge/devices", _encode(DISCOVERY_PAYLOAD))

    devices = {d.ieee_address: d for d in _devices()}
    assert len(devices) == 2
    light = devices["00:11:22:33:44:55:66:77"]
    assert light.friendly_name == "Living Room Light"
    assert light.type == DeviceType.LIGHT.value
    sensor = devices["AA:BB:CC:DD:EE:FF:00:11"]
    assert sensor.friendly_name == "Kitchen Sensor"
    assert sensor.type == DeviceType.SENSOR.value


def test_consume_devices_empty_array_marks_existing_unavailable():
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:77",
                friendly_name="Existing Device",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_devices("zigbee2mqtt/bridge/devices", b"[]")

    with read_session() as session:
        updated = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:77", session)
    assert updated.available is False


def test_consume_devices_invalid_json_does_not_raise():
    consumers.consume_devices("zigbee2mqtt/bridge/devices", b"{ invalid json }")
    assert _devices() == []


def test_consume_devices_updates_existing_without_touching_availability():
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:77",
                friendly_name="Old Name",
                type=DeviceType.OTHER.value,
                available=False,
            ),
            session,
        )

    consumers.consume_devices("zigbee2mqtt/bridge/devices", _encode(DISCOVERY_PAYLOAD[:1]))

    with read_session() as session:
        updated = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:77", session)
    assert updated.friendly_name == "Living Room Light"
    assert updated.type == DeviceType.LIGHT.value
    # availability is owned by the availability topic, not by discovery
    assert updated.available is False


def test_consume_telemetry_writes_known_fields(written):
    consumers.consume_telemetry(
        "zigbee2mqtt/living_room", _encode({"temperature": 22.5, "humidity": 55})
    )
    assert written == [("living_room", "sensor_data", {"temperature": 22.5, "humidity": 55})]


def test_consume_telemetry_bridge_topic_skipped(written):
    consumers.consume_telemetry("zigbee2mqtt/bridge/devices", _encode({"temperature": 22.5}))
    assert written == []


def test_consume_telemetry_no_known_fields_skipped(written):
    consumers.consume_telemetry("zigbee2mqtt/living_room", _encode({"unknown": 1}))
    assert written == []


def test_consume_telemetry_mixed_payload_filters_unknown_fields(written):
    consumers.consume_telemetry(
        "zigbee2mqtt/living_room",
        _encode({"temperature": 22.5, "update_available": False, "state": "ON"}),
    )
    assert written == [("living_room", "sensor_data", {"temperature": 22.5})]


def test_consume_telemetry_invalid_json_does_not_raise(written):
    consumers.consume_telemetry("zigbee2mqtt/living_room", b"not json")
    assert written == []


def test_consume_telemetry_all_known_fields(written):
    payload = {
        "temperature": 21.0,
        "humidity": 50,
        "battery": 90,
        "power": 12.5,
        "voltage": 230,
        "energy": 1.25,
        "linkquality": 120,
        "contact": True,
    }
    consumers.consume_telemetry("zigbee2mqtt/multi", _encode(payload))
    assert written[0][2] == payload


def test_consume_availability_updates_device(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:77",
                friendly_name="hallway_light",
                type=DeviceType.LIGHT.value,
                available=False,
            ),
            session,
        )

    consumers.consume_availability(
        "zigbee2mqtt/hallway_light/availability", b'{"state":"online"}'
    )

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:77", session)
    assert device.available is True
    assert device.last_seen is not None

    consumers.consume_availability("zigbee2mqtt/hallway_light/availability", b"offline")

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:77", session)
    assert device.available is False


def test_consume_availability_ignores_unknown_device():
    consumers.consume_availability("zigbee2mqtt/ghost/availability", b"online")


def test_consume_bridge_state():
    consumers.consume_bridge_state("zigbee2mqtt/bridge/state", b'{"state":"online"}')
    assert bridge_state_holder.state is BridgeState.ONLINE
    assert bridge_state_holder.last_change is not None

    consumers.consume_bridge_state("zigbee2mqtt/bridge/state", b"offline")
    assert bridge_state_holder.state is BridgeState.OFFLINE


def test_health_reflects_bridge_state(client):
    consumers.consume_bridge_state("zigbee2mqtt/bridge/state", b"offline")
    response = client.get("/q/health")
    assert response.status_code == 503
    assert response.json()["checks"][0] == {
        "name": "zigbee2mqtt-bridge",
        "status": "DOWN",
        "data": {"state": "offline", "lastChange": response.json()["checks"][0]["data"]["lastChange"]},
    }

    consumers.consume_bridge_state("zigbee2mqtt/bridge/state", b"online")
    assert client.get("/q/health").json()["status"] == "UP"
