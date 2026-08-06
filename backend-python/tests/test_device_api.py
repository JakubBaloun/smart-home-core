"""Mirror of DeviceResourceTest and CommandResourceTest."""

import json

import pytest

from app.db import transaction
from app.device.models import Device, DeviceType
from app.device.repository import device_repository


@pytest.fixture
def seeded_device_id() -> int:
    device = Device(
        ieee_address="00:11:22:33:44:55",
        friendly_name="Living Room Sensor",
        type=DeviceType.SENSOR.value,
        vendor="Aqara",
        model="WSDCGQ11LM",
        available=True,
    )
    with transaction() as session:
        device_repository.save(device, session)
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


def test_list_devices(client, seeded_device_id):
    response = client.get("/api/devices")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["ieeeAddress"] == "00:11:22:33:44:55"
    assert body[0]["friendlyName"] == "Living Room Sensor"
    assert body[0]["type"] == "SENSOR"


def test_get_device_by_id(client, seeded_device_id):
    response = client.get(f"/api/devices/{seeded_device_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seeded_device_id
    assert body["ieeeAddress"] == "00:11:22:33:44:55"
    assert body["friendlyName"] == "Living Room Sensor"
    assert body["type"] == "SENSOR"
    assert body["vendor"] == "Aqara"
    assert body["model"] == "WSDCGQ11LM"
    assert body["available"] is True
    assert body["createdAt"] is not None
    assert body["updatedAt"] is not None


def test_get_device_by_id_includes_null_state_by_default(client, seeded_device_id):
    response = client.get(f"/api/devices/{seeded_device_id}")
    assert response.status_code == 200
    body = response.json()
    assert "state" in body
    assert body["state"] is None


def test_get_device_by_id_includes_null_brightness_and_color_temp_by_default(client, seeded_device_id):
    response = client.get(f"/api/devices/{seeded_device_id}")
    assert response.status_code == 200
    body = response.json()
    assert "brightness" in body
    assert body["brightness"] is None
    assert "colorTemp" in body
    assert body["colorTemp"] is None


def test_get_device_not_found(client):
    response = client.get("/api/devices/999999")
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "Device with id '999999' not found",
        "status": 404,
    }


def test_update_friendly_name(client, seeded_device_id):
    response = client.put(
        f"/api/devices/{seeded_device_id}", json={"friendlyName": "Kitchen Sensor"}
    )
    assert response.status_code == 204

    assert client.get(f"/api/devices/{seeded_device_id}").json()["friendlyName"] == "Kitchen Sensor"


def test_update_type(client, seeded_device_id):
    response = client.put(
        f"/api/devices/{seeded_device_id}",
        json={"friendlyName": "Living Room Sensor", "type": "LIGHT"},
    )
    assert response.status_code == 204
    assert client.get(f"/api/devices/{seeded_device_id}").json()["type"] == "LIGHT"


def test_update_device_not_found(client):
    response = client.put("/api/devices/999999", json={"friendlyName": "New Name"})
    assert response.status_code == 404
    assert response.json()["title"] == "Not Found"


def test_update_blank_friendly_name(client, seeded_device_id):
    response = client.put(f"/api/devices/{seeded_device_id}", json={"friendlyName": ""})
    assert response.status_code == 400


def test_delete_device(client, seeded_device_id):
    assert client.delete(f"/api/devices/{seeded_device_id}").status_code == 204
    assert client.get(f"/api/devices/{seeded_device_id}").status_code == 404


def test_delete_device_not_found(client):
    response = client.delete("/api/devices/999999")
    assert response.status_code == 404
    assert response.json()["title"] == "Not Found"


def test_set_state_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setState", "payload": {"state": "ON"}},
    )
    assert response.status_code == 202
    assert published == [
        ("zigbee2mqtt/Living Room Sensor/set", json.dumps({"state": "ON"}, separators=(",", ":")).encode())
    ]


def test_set_brightness_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setBrightness", "payload": {"brightness": 200}},
    )
    assert response.status_code == 202
    assert b'"brightness":200' in published[0][1]


def test_set_color_temp_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColorTemp", "payload": {"color_temp": 370}},
    )
    assert response.status_code == 202
    assert b'"color_temp":370' in published[0][1]


def test_raw_command_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "raw", "payload": {"state": "ON", "brightness": 100}},
    )
    assert response.status_code == 202
    assert published[0][0] == "zigbee2mqtt/Living Room Sensor/set"


def test_command_unknown_device_returns_404(client, published):
    response = client.post(
        "/api/devices/999999/command", json={"command": "setState", "payload": {"state": "ON"}}
    )
    assert response.status_code == 404


def test_command_unavailable_device_returns_409(client, published):
    device = Device(
        ieee_address="AA:BB:CC:DD:EE:FF",
        friendly_name="broken_sensor",
        type=DeviceType.SENSOR.value,
        available=False,
    )
    with transaction() as session:
        device_repository.save(device, session)
        session.flush()
        device_id = device.id

    response = client.post(
        f"/api/devices/{device_id}/command",
        json={"command": "setState", "payload": {"state": "ON"}},
    )
    assert response.status_code == 409
    assert response.json()["title"] == "Device Unavailable"
    assert published == []


def test_unknown_command_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "launchRocket", "payload": {}},
    )
    assert response.status_code == 400
    assert "launchRocket" in response.json()["detail"]


def test_missing_payload_field_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command", json={"command": "setState", "payload": {}}
    )
    assert response.status_code == 400
    assert "state" in response.json()["detail"]


def test_blank_command_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "", "payload": {"state": "ON"}},
    )
    assert response.status_code == 400


def test_get_device_by_id_includes_color_fields_defaults(client, seeded_device_id):
    body = client.get(f"/api/devices/{seeded_device_id}").json()
    assert body["hue"] is None
    assert body["saturation"] is None
    assert body["colorMode"] is None
    # sensor with no exposes -> supportsColor False, not null
    assert body["supportsColor"] is False


def test_get_device_by_id_derives_supports_color_from_exposes(client):
    from app.db import transaction
    from app.device.models import Device, DeviceType
    from app.device.repository import device_repository

    with transaction() as session:
        device = Device(
            ieee_address="AA:BB:CC:DD:EE:FF:00:22",
            friendly_name="rgb_bulb",
            type=DeviceType.LIGHT.value,
            available=True,
            hue=120,
            saturation=75,
            color_mode="hs",
            exposes=[
                {
                    "type": "light",
                    "features": [
                        {
                            "type": "composite",
                            "name": "color_hs",
                            "features": [
                                {"name": "hue", "type": "numeric"},
                                {"name": "saturation", "type": "numeric"},
                            ],
                        }
                    ],
                }
            ],
        )
        device_repository.save(device, session)
        session.flush()
        device_id = device.id

    body = client.get(f"/api/devices/{device_id}").json()
    assert body["hue"] == 120
    assert body["saturation"] == 75
    assert body["colorMode"] == "hs"
    assert body["supportsColor"] is True
    assert "exposes" not in body


def test_set_color_returns_202(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200, "saturation": 80}},
    )
    assert response.status_code == 202
    assert published == [
        (
            "zigbee2mqtt/Living Room Sensor/set",
            b'{"color":{"hue":200,"saturation":80}}',
        )
    ]


def test_set_color_missing_hue_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"saturation": 80}},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["title"] == "Bad Request"
    assert "hue" in body["detail"]
    assert published == []


def test_set_color_missing_saturation_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200}},
    )
    assert response.status_code == 400
    assert "saturation" in response.json()["detail"]


def test_set_color_hue_out_of_range_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 400, "saturation": 50}},
    )
    assert response.status_code == 400
    assert "hue" in response.json()["detail"]
    assert published == []


def test_set_color_negative_hue_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": -1, "saturation": 50}},
    )
    assert response.status_code == 400


def test_set_color_saturation_out_of_range_returns_400(client, seeded_device_id, published):
    response = client.post(
        f"/api/devices/{seeded_device_id}/command",
        json={"command": "setColor", "payload": {"hue": 200, "saturation": 101}},
    )
    assert response.status_code == 400
    assert "saturation" in response.json()["detail"]
