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


def test_consume_telemetry_writes_state_to_postgres_not_influx(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:88",
                friendly_name="living_room",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/living_room",
        _encode({"temperature": 22.5, "state": "ON"}),
    )

    # state never reaches InfluxDB
    assert written == [("00:11:22:33:44:55:66:88", "sensor_data", {"temperature": 22.5})]

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:88", session)
    assert device.state == "ON"


def test_consume_telemetry_writes_brightness_and_color_temp_to_postgres_not_influx(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:AA",
                friendly_name="living_room_light",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/living_room_light",
        _encode({"brightness": 180, "color_temp": 300}),
    )

    # brightness/color_temp never reach InfluxDB
    assert written == []

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:AA", session)
    assert device.brightness == 180
    assert device.color_temp == 300


def test_consume_telemetry_partial_brightness_update_does_not_clobber_color_temp(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:BB",
                friendly_name="bedroom_light",
                type=DeviceType.LIGHT.value,
                available=True,
                brightness=50,
                color_temp=250,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/bedroom_light", _encode({"brightness": 200}))

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:BB", session)
    assert device.brightness == 200
    assert device.color_temp == 250


def test_consume_telemetry_partial_color_temp_update_does_not_clobber_brightness(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:CC",
                friendly_name="bedroom_light_2",
                type=DeviceType.LIGHT.value,
                available=True,
                brightness=50,
                color_temp=250,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/bedroom_light_2", _encode({"color_temp": 400}))

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:CC", session)
    assert device.brightness == 50
    assert device.color_temp == 400


def test_consume_telemetry_boolean_brightness_is_rejected(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:DD",
                friendly_name="bool_light",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/bool_light", _encode({"brightness": True}))

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:DD", session)
    assert device.brightness is None


def test_consume_telemetry_brightness_for_unknown_device_does_not_raise(written):
    consumers.consume_telemetry("zigbee2mqtt/ghost", _encode({"brightness": 180, "color_temp": 300}))
    assert written == []


def test_consume_telemetry_state_only_payload_updates_device_without_influx_write(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:99",
                friendly_name="hallway_switch",
                type=DeviceType.SWITCH.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/hallway_switch", _encode({"state": "OFF"}))

    assert written == []

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:99", session)
    assert device.state == "OFF"


def test_consume_telemetry_state_for_unknown_device_does_not_raise(written):
    consumers.consume_telemetry("zigbee2mqtt/ghost", _encode({"state": "ON"}))
    assert written == []


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


def test_known_fields_includes_state():
    from app.telemetry.fields import KNOWN_FIELDS, KNOWN_FIELDS_ORDERED

    assert "state" in KNOWN_FIELDS
    assert "state" in KNOWN_FIELDS_ORDERED


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


def test_consume_telemetry_writes_color_hue_saturation_and_mode_to_postgres(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:EE",
                friendly_name="rgb_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb",
        _encode({"color": {"hue": 200, "saturation": 80}, "color_mode": "hs"}),
    )

    # color fields never reach InfluxDB
    assert written == []

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:EE", session)
    assert device.hue == 200
    assert device.saturation == 80
    assert device.color_mode == "hs"


def test_consume_telemetry_partial_color_update_does_not_clobber_brightness_or_temp(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:FE",
                friendly_name="rgb_bulb_2",
                type=DeviceType.LIGHT.value,
                available=True,
                brightness=100,
                color_temp=300,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb_2", _encode({"color": {"hue": 10, "saturation": 90}})
    )

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:FE", session)
    assert device.brightness == 100
    assert device.color_temp == 300
    assert device.hue == 10
    assert device.saturation == 90


def test_consume_telemetry_color_mode_only_update(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:FF",
                friendly_name="rgb_bulb_3",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry(
        "zigbee2mqtt/rgb_bulb_3", _encode({"color_mode": "color_temp"})
    )

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:FF", session)
    assert device.color_mode == "color_temp"
    assert device.hue is None
    assert device.saturation is None


def test_consume_telemetry_non_dict_color_field_is_ignored(written):
    with transaction() as session:
        device_repository.save(
            Device(
                ieee_address="00:11:22:33:44:55:66:AC",
                friendly_name="weird_bulb",
                type=DeviceType.LIGHT.value,
                available=True,
            ),
            session,
        )

    consumers.consume_telemetry("zigbee2mqtt/weird_bulb", _encode({"color": "red"}))

    with read_session() as session:
        device = device_repository.find_by_ieee_address("00:11:22:33:44:55:66:AC", session)
    assert device.hue is None
    assert device.saturation is None
