"""Telemetry identity: ieee_address is the key, friendly_name is a label.

Covers the rename path end to end — the alias trail, the Z2M rename request,
the InfluxDB tag, and the read-side union that keeps pre-rename history visible.
"""

import json
from datetime import datetime, timezone

import pytest

from app.db import read_session, transaction
from app.device.identity import DeviceIdentity
from app.device.models import Device, DeviceType
from app.device.repository import device_repository
from app.device.service import RENAME_REQUEST_TOPIC, device_service
from app.mqtt import consumers
from app.telemetry.service import device_filter, telemetry_service

IEEE = "00:11:22:33:44:55"


@pytest.fixture
def device_id() -> int:
    device = Device(
        ieee_address=IEEE,
        friendly_name="thermometer",
        type=DeviceType.SENSOR.value,
        available=True,
    )
    with transaction() as session:
        device_repository.save(device, session)
        device_repository.add_alias(IEEE, "thermometer", session)
        session.flush()
        return device.id


@pytest.fixture
def published(monkeypatch) -> list[tuple[str, bytes]]:
    sent: list[tuple[str, bytes]] = []
    monkeypatch.setattr(
        "app.mqtt.publisher.mqtt_publisher.publish",
        lambda topic, payload, qos=1, retain=False: sent.append((topic, payload)),
    )
    return sent


@pytest.fixture
def written(monkeypatch) -> list[tuple[str, str, dict]]:
    calls: list[tuple[str, str, dict]] = []
    monkeypatch.setattr(
        telemetry_service,
        "write_telemetry",
        lambda device, measurement, fields: calls.append((device, measurement, fields)),
    )
    consumers._unregistered_names.clear()
    return calls


def _encode(payload) -> bytes:
    return json.dumps(payload).encode("utf-8")


# --- identity resolution ----------------------------------------------------


def test_resolve_by_ieee_friendly_name_and_alias(client, device_id):
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})

    for identifier in (IEEE, "hallway thermometer", "thermometer"):
        identity = device_service.resolve_identity(identifier)
        assert identity is not None, identifier
        assert identity.ieee_address == IEEE
        assert identity.friendly_name == "hallway thermometer"


def test_resolve_unknown_name_returns_none(device_id):
    assert device_service.resolve_identity("does not exist") is None


def test_telemetry_keys_lead_with_ieee_and_dedupe():
    identity = DeviceIdentity(IEEE, "new", ["new", "old", "older"])
    assert identity.telemetry_keys == [IEEE, "new", "old", "older"]


# --- rename -----------------------------------------------------------------


def test_rename_records_old_name_as_alias(client, device_id, published):
    assert (
        client.put(
            f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"}
        ).status_code
        == 204
    )

    with read_session() as session:
        assert set(device_repository.list_aliases(IEEE, session)) == {
            "thermometer",
            "hallway thermometer",
        }


def test_rename_asks_z2m_to_rename_the_device(client, device_id, published):
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})

    assert len(published) == 1
    topic, payload = published[0]
    assert topic == RENAME_REQUEST_TOPIC
    assert json.loads(payload) == {
        "from": "thermometer",
        "to": "hallway thermometer",
        "homeassistant_rename": False,
    }


def test_update_without_rename_does_not_touch_z2m(client, device_id, published):
    response = client.put(
        f"/api/devices/{device_id}", json={"friendlyName": "thermometer", "type": "LIGHT"}
    )
    assert response.status_code == 204
    assert published == []


def test_rename_succeeds_even_when_the_broker_is_down(client, device_id):
    """The label change is valid on its own — an unreachable broker must not 500
    the request, because nothing downstream depends on Z2M agreeing."""
    response = client.put(f"/api/devices/{device_id}", json={"friendlyName": "renamed"})
    assert response.status_code == 204
    assert client.get(f"/api/devices/{device_id}").json()["friendlyName"] == "renamed"
    with read_session() as session:
        assert "thermometer" in device_repository.list_aliases(IEEE, session)


def test_rename_response_error_is_tolerated():
    consumers.consume_rename_response(
        "zigbee2mqtt/bridge/response/device/rename",
        _encode({"data": {"from": "a", "to": "b"}, "status": "error", "error": "nope"}),
    )
    consumers.consume_rename_response("zigbee2mqtt/bridge/response/device/rename", b"not json")


# --- write path -------------------------------------------------------------


def test_telemetry_is_tagged_with_the_ieee_address(device_id, written):
    consumers.consume_telemetry("zigbee2mqtt/thermometer", _encode({"temperature": 21.5}))
    assert written == [(IEEE, "sensor_data", {"temperature": 21.5})]


def test_telemetry_on_the_pre_rename_topic_still_lands_on_the_device(
    client, device_id, published, written
):
    """Z2M may not have applied the rename. The old topic name is an alias, so
    the reading still gets the right tag instead of silently stopping."""
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})

    consumers.consume_telemetry("zigbee2mqtt/thermometer", _encode({"temperature": 22.0}))
    assert written == [(IEEE, "sensor_data", {"temperature": 22.0})]


def test_telemetry_from_an_unregistered_device_is_still_written(written):
    consumers.consume_telemetry("zigbee2mqtt/mystery", _encode({"temperature": 5.0}))
    assert written == [("mystery", "sensor_data", {"temperature": 5.0})]


def test_rule_event_carries_the_registry_name(device_id, written, monkeypatch):
    seen: list[str] = []
    monkeypatch.setattr(
        "app.mqtt.consumers.event_bus.publish", lambda event: seen.append(event.device_name)
    )
    consumers.consume_telemetry("zigbee2mqtt/thermometer", _encode({"temperature": 21.5}))
    assert seen == ["thermometer"]


def test_availability_on_the_pre_rename_topic_still_updates(client, device_id, published):
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})
    consumers.consume_availability("zigbee2mqtt/thermometer/availability", b"offline")

    assert client.get(f"/api/devices/{device_id}").json()["available"] is False


# --- sync -------------------------------------------------------------------


def test_sync_records_every_name_z2m_has_used(device_id):
    payload = [
        {
            "ieee_address": IEEE,
            "friendly_name": "kitchen thermometer",
            "definition": {"description": "Temperature sensor"},
        }
    ]
    consumers.consume_devices("zigbee2mqtt/bridge/devices", _encode(payload))

    with read_session() as session:
        assert set(device_repository.list_aliases(IEEE, session)) == {
            "thermometer",
            "kitchen thermometer",
        }


def test_an_alias_belongs_to_one_device_only(device_id):
    other = Device(ieee_address="AA:BB:CC", friendly_name="other", type=DeviceType.SENSOR.value)
    with transaction() as session:
        device_repository.save(other, session)
        assert device_repository.add_alias("AA:BB:CC", "thermometer", session) is False

    identity = device_service.resolve_identity("thermometer")
    assert identity.ieee_address == IEEE


def test_deleting_a_device_drops_its_aliases(client, device_id):
    client.delete(f"/api/devices/{device_id}")
    with read_session() as session:
        assert device_repository.list_aliases(IEEE, session) == []


# --- read path --------------------------------------------------------------


def test_device_filter_unions_and_dedupes():
    assert device_filter(["a", "b"]) == 'r.device_id == "a" or r.device_id == "b"'
    assert device_filter("a") == 'r.device_id == "a"'
    # sanitizing can collapse two names onto one tag value
    assert device_filter(["a b", "ab"]) == 'r.device_id == "ab"'


def test_device_filter_rejects_empty():
    with pytest.raises(ValueError):
        device_filter([])


class _Record:
    def __init__(self, time, value, field="temperature"):
        self._time, self._value, self._field = time, value, field

    def get_time(self):
        return self._time

    def get_value(self):
        return self._value

    def get_field(self):
        return self._field


class _Table:
    def __init__(self, records):
        self.records = records


@pytest.fixture
def queried(monkeypatch) -> dict:
    recorded: dict = {}

    def _history(device_ids, *args):
        recorded["history"] = device_ids
        return [
            _Table([_Record(datetime(2026, 1, 1, 12, tzinfo=timezone.utc), 21.0)]),
            _Table([_Record(datetime(2026, 1, 1, 10, tzinfo=timezone.utc), 20.0)]),
        ]

    def _latest(device_ids):
        recorded["latest"] = device_ids
        return [
            _Table([_Record(datetime(2026, 1, 1, 10, tzinfo=timezone.utc), 20.0)]),
            _Table([_Record(datetime(2026, 1, 1, 12, tzinfo=timezone.utc), 21.0)]),
            _Table([_Record(datetime(2026, 1, 1, 11, tzinfo=timezone.utc), 55.0, "humidity")]),
        ]

    monkeypatch.setattr(telemetry_service, "query_telemetry", _history)
    monkeypatch.setattr(telemetry_service, "query_latest", _latest)
    return recorded


def test_history_queries_the_ieee_address_and_every_former_name(
    client, device_id, published, queried
):
    """The reported bug: charts went blank because history sat under the old
    name. Asking by ieee address must still reach it."""
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})

    response = client.get(
        f"/api/telemetry/{IEEE}",
        params={"field": "temperature", "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z"},
    )
    assert response.status_code == 200
    assert queried["history"] == [IEEE, "hallway thermometer", "thermometer"]
    assert response.json()["deviceName"] == "hallway thermometer"


def test_history_points_are_sorted_across_tag_values(client, device_id, queried):
    response = client.get(
        f"/api/telemetry/{IEEE}",
        params={"field": "temperature", "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z"},
    )
    assert [p["value"] for p in response.json()["points"]] == [20.0, 21.0]


def test_history_by_a_former_name_still_resolves(client, device_id, published, queried):
    client.put(f"/api/devices/{device_id}", json={"friendlyName": "hallway thermometer"})

    client.get(
        "/api/telemetry/thermometer",
        params={"field": "temperature", "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z"},
    )
    assert queried["history"] == [IEEE, "hallway thermometer", "thermometer"]


def test_history_for_an_unknown_identifier_is_queried_verbatim(client, queried):
    client.get(
        "/api/telemetry/ghost",
        params={"field": "temperature", "from": "2026-01-01T00:00:00Z", "to": "2026-01-02T00:00:00Z"},
    )
    assert queried["history"] == ["ghost"]


def test_latest_takes_the_newest_record_per_field(client, device_id, queried):
    body = client.get(f"/api/telemetry/{IEEE}/latest").json()
    assert body["values"] == {"temperature": 21.0, "humidity": 55.0}
    assert body["deviceName"] == "thermometer"
