"""Mirror of TelemetryResourceTest — the InfluxDB layer is stubbed, as with
@InjectMock TelemetryService in Quarkus."""

from datetime import datetime, timezone

import pytest

from app.telemetry.service import telemetry_service

FROM = "2026-01-01T00:00:00Z"
TO = "2026-01-02T00:00:00Z"


class FakeRecord:
    def __init__(self, time: datetime, value: float, field: str = "temperature") -> None:
        self._time = time
        self._value = value
        self._field = field

    def get_time(self):
        return self._time

    def get_value(self):
        return self._value

    def get_field(self):
        return self._field


class FakeTable:
    def __init__(self, records: list[FakeRecord]) -> None:
        self.records = records


@pytest.fixture
def calls(monkeypatch) -> dict:
    recorded: dict = {}

    def _query(*args):
        recorded["query"] = args
        return [FakeTable([FakeRecord(datetime(2026, 1, 1, 10, tzinfo=timezone.utc), 22.5)])]

    def _query_aggregated(*args):
        recorded["aggregated"] = args
        return [FakeTable([FakeRecord(datetime(2026, 1, 1, 10, tzinfo=timezone.utc), 21.0)])]

    def _query_latest(*args):
        recorded["latest"] = args
        return [
            FakeTable(
                [
                    FakeRecord(datetime(2026, 1, 1, 12, tzinfo=timezone.utc), 22.5, "temperature"),
                    FakeRecord(datetime(2026, 1, 1, 12, tzinfo=timezone.utc), 60.0, "humidity"),
                ]
            )
        ]

    monkeypatch.setattr(telemetry_service, "query_telemetry", _query)
    monkeypatch.setattr(telemetry_service, "query_telemetry_aggregated", _query_aggregated)
    monkeypatch.setattr(telemetry_service, "query_latest", _query_latest)
    return recorded


def test_get_history_returns_points(client, calls):
    response = client.get(
        "/api/telemetry/sensor-1", params={"field": "temperature", "from": FROM, "to": TO}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["deviceName"] == "sensor-1"
    assert body["field"] == "temperature"
    assert len(body["points"]) == 1
    assert body["points"][0]["value"] == 22.5


def test_get_history_with_aggregation_returns_points(client, calls):
    response = client.get(
        "/api/telemetry/sensor-1",
        params={
            "field": "temperature",
            "from": FROM,
            "to": TO,
            "aggregate": "mean",
            "window": "5m",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == 1
    assert body["points"][0]["value"] == 21.0
    assert calls["aggregated"][-2:] == ("mean", "5m")


def test_get_latest_returns_values(client, calls):
    response = client.get("/api/telemetry/sensor-1/latest")
    assert response.status_code == 200
    body = response.json()
    assert body["deviceName"] == "sensor-1"
    assert body["values"]["temperature"] == 22.5
    assert body["values"]["humidity"] == 60.0
    assert body["lastUpdated"] is not None


@pytest.mark.parametrize(
    "params",
    [
        {"from": FROM, "to": TO},
        {"field": "unknown_field", "from": FROM, "to": TO},
        {"field": "temperature", "to": TO},
        {"field": "temperature", "from": "not-a-timestamp", "to": TO},
        {"field": "temperature", "from": TO, "to": FROM},
        {"field": "temperature", "from": FROM, "to": TO, "aggregate": "mean"},
        {"field": "temperature", "from": FROM, "to": TO, "aggregate": "median", "window": "5m"},
        {"field": "temperature", "from": FROM, "to": TO, "aggregate": "mean", "window": "5x"},
    ],
)
def test_get_history_invalid_params_return_400(client, calls, params):
    response = client.get("/api/telemetry/sensor-1", params=params)
    assert response.status_code == 400
    assert response.json()["title"] == "Bad Request"


def test_get_history_missing_field_message(client, calls):
    response = client.get("/api/telemetry/sensor-1", params={"from": FROM, "to": TO})
    assert "field" in response.json()["detail"]
