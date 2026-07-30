"""Mirror of TelemetryService."""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from influxdb_client import Point, WritePrecision

from app.common.exceptions import TelemetryError
from app.config import get_settings
from app.telemetry import client

log = logging.getLogger(__name__)

_SANITIZE_PATTERN = re.compile(r"[^a-zA-Z0-9_\-]")


class TelemetryService:
    def write_telemetry(self, device_id: str, measurement: str, fields: dict[str, Any]) -> None:
        settings = get_settings()
        try:
            point = Point(sanitize(measurement)).tag("device_id", sanitize(device_id))
            for key, value in normalize_fields(fields).items():
                point = point.field(key, value)
            point = point.time(datetime.now(timezone.utc), WritePrecision.MS)
            client.get_write_api().write(
                bucket=settings.influxdb_bucket, org=settings.influxdb_org, record=point
            )
        except Exception as e:
            log.error("Failed to write telemetry for device %s: %s", device_id, e)
            raise TelemetryError("Failed to write telemetry") from e
        log.debug("Written telemetry for device %s, measurement %s", device_id, measurement)

    def query_telemetry(
        self, device_id: str, measurement: str, field: str, from_: datetime, to: datetime
    ) -> list[Any]:
        settings = get_settings()
        flux = (
            f'from(bucket: "{settings.influxdb_bucket}")\n'
            f"  |> range(start: {_instant(from_)}, stop: {_instant(to)})\n"
            f'  |> filter(fn: (r) => r._measurement == "{sanitize(measurement)}")\n'
            f'  |> filter(fn: (r) => r.device_id == "{sanitize(device_id)}")\n'
            f'  |> filter(fn: (r) => r._field == "{sanitize(field)}")\n'
        )
        try:
            tables = client.get_query_api().query(flux, org=settings.influxdb_org)
        except Exception as e:
            log.error("Failed to query telemetry for device %s: %s", device_id, e)
            raise TelemetryError("Failed to query telemetry") from e
        log.info(
            "Queried telemetry for device %s, field %s, got %d tables", device_id, field, len(tables)
        )
        return tables

    def query_telemetry_aggregated(
        self,
        device_id: str,
        measurement: str,
        field: str,
        from_: datetime,
        to: datetime,
        aggregate: str,
        window: str,
    ) -> list[Any]:
        settings = get_settings()
        flux = (
            f'from(bucket: "{settings.influxdb_bucket}")\n'
            f"  |> range(start: {_instant(from_)}, stop: {_instant(to)})\n"
            f'  |> filter(fn: (r) => r._measurement == "{sanitize(measurement)}")\n'
            f'  |> filter(fn: (r) => r.device_id == "{sanitize(device_id)}")\n'
            f'  |> filter(fn: (r) => r._field == "{sanitize(field)}")\n'
            f"  |> aggregateWindow(every: {window}, fn: {aggregate}, createEmpty: false)\n"
        )
        try:
            tables = client.get_query_api().query(flux, org=settings.influxdb_org)
        except Exception as e:
            log.error("Failed to query aggregated telemetry for device %s: %s", device_id, e)
            raise TelemetryError("Failed to query telemetry") from e
        log.info("Queried aggregated telemetry for device %s, field %s", device_id, field)
        return tables

    def query_latest(self, device_id: str) -> list[Any]:
        settings = get_settings()
        flux = (
            f'from(bucket: "{settings.influxdb_bucket}")\n'
            f"  |> range(start: -24h)\n"
            f'  |> filter(fn: (r) => r._measurement == "sensor_data")\n'
            f'  |> filter(fn: (r) => r.device_id == "{sanitize(device_id)}")\n'
            f"  |> last()\n"
        )
        try:
            tables = client.get_query_api().query(flux, org=settings.influxdb_org)
        except Exception as e:
            log.error("Failed to query latest telemetry for device %s: %s", device_id, e)
            raise TelemetryError("Failed to query latest telemetry") from e
        log.info("Queried latest telemetry for device %s", device_id)
        return tables


def normalize_fields(fields: dict[str, Any]) -> dict[str, Any]:
    """InfluxDB fixes a field's type on first write, so every number is coerced to
    float. bool is a subclass of int in Python and must be checked first."""
    normalized: dict[str, Any] = {}
    for key, value in fields.items():
        if isinstance(value, bool):
            normalized[key] = value
        elif isinstance(value, (int, float)):
            normalized[key] = float(value)
        else:
            log.debug(
                "Skipping non-numeric telemetry field '%s' of type %s",
                key,
                "null" if value is None else type(value).__name__,
            )
    return normalized


def sanitize(value: str | None) -> str:
    if value is None or not value.strip():
        raise ValueError("Input cannot be null or blank")
    return _SANITIZE_PATTERN.sub("", value)


def _instant(value: datetime) -> str:
    """Instant.toString() equivalent — always UTC, always 'Z'."""
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


telemetry_service = TelemetryService()
