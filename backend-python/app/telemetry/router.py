"""Mirror of TelemetryResource."""

import logging
import re
from datetime import datetime

from fastapi import APIRouter, Query

from app.common.exceptions import BadRequestError
from app.device.service import device_service
from app.telemetry.fields import KNOWN_FIELDS, KNOWN_FIELDS_ORDERED
from app.telemetry.schemas import LatestTelemetryResponse, TelemetryPoint, TelemetryResponse
from app.telemetry.service import telemetry_service

log = logging.getLogger(__name__)

VALID_AGGREGATES = ("mean", "max", "min")
VALID_WINDOW = re.compile(r"^\d+[smhd]$")

telemetry_router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


def _resolve(device_name: str) -> tuple[list[str], str]:
    """Map the path identifier to the tag values to query and the name to echo.

    The identifier may be an ieee address (what the frontend now sends), the
    current friendly name, or any name the device used to have — all three
    resolve to the same device and therefore to the same full history. An
    identifier that matches no device falls through untouched, so telemetry from
    devices that were never in the registry, or that have since been deleted,
    stays queryable by name.
    """
    identity = device_service.resolve_identity(device_name)
    if identity is None:
        log.debug("Telemetry identifier '%s' matches no known device", device_name)
        return [device_name], device_name
    return identity.telemetry_keys, identity.friendly_name


@telemetry_router.get("/{device_name}/latest", response_model=LatestTelemetryResponse)
def get_latest(device_name: str) -> LatestTelemetryResponse:
    log.info("Request received for latest telemetry: device=%s", device_name)

    device_ids, device_name = _resolve(device_name)
    tables = telemetry_service.query_latest(device_ids)
    values: dict[str, float] = {}
    last_updated: datetime | None = None

    # The union query returns one `last()` record per field *per tag value*, so
    # a device with pre-rename history yields two candidates for the same field.
    # Keep the most recent; an undated record only fills an empty slot.
    field_times: dict[str, datetime] = {}

    for table in tables:
        for record in table.records:
            field = record.get_field()
            if field is None or record.get_value() is None:
                continue
            time = record.get_time()
            known = field_times.get(field)
            if field in values and not (time is not None and (known is None or time > known)):
                continue
            values[field] = float(record.get_value())
            if time is not None:
                field_times[field] = time
                if last_updated is None or time > last_updated:
                    last_updated = time

    return LatestTelemetryResponse(
        deviceName=device_name, values=values, lastUpdated=last_updated
    )


@telemetry_router.get("/{device_name}", response_model=TelemetryResponse)
def get_history(
    device_name: str,
    field: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    aggregate: str | None = None,
    window: str | None = None,
) -> TelemetryResponse:
    log.info("Request received for telemetry history: device=%s, field=%s", device_name, field)

    from_instant, to_instant = _validate_history_params(field, from_, to, aggregate, window)

    device_ids, device_name = _resolve(device_name)

    if aggregate is not None:
        tables = telemetry_service.query_telemetry_aggregated(
            device_ids, "sensor_data", field, from_instant, to_instant, aggregate, window
        )
    else:
        tables = telemetry_service.query_telemetry(
            device_ids, "sensor_data", field, from_instant, to_instant
        )

    points = [
        TelemetryPoint(time=record.get_time(), value=float(record.get_value()))
        for table in tables
        for record in table.records
        if record.get_value() is not None
    ]
    # Influx returns one table per tag value, so a device whose history spans a
    # rename comes back as two concatenated runs. The chart plots in array
    # order — sort or it zigzags.
    points.sort(key=lambda p: (p.time is None, p.time))
    return TelemetryResponse(deviceName=device_name, field=field, points=points)


def _validate_history_params(
    field: str | None,
    from_: str | None,
    to: str | None,
    aggregate: str | None,
    window: str | None,
) -> tuple[datetime, datetime]:
    if field is None or field not in KNOWN_FIELDS:
        raise BadRequestError("'field' must be one of: " + ", ".join(KNOWN_FIELDS_ORDERED))
    if from_ is None or to is None:
        raise BadRequestError("Query parameters 'from' and 'to' are required")

    from_instant = _parse_instant(from_)
    to_instant = _parse_instant(to)
    if from_instant is None or to_instant is None:
        raise BadRequestError(
            "'from' and 'to' must be valid ISO-8601 timestamps (e.g. 2024-01-01T00:00:00Z)"
        )

    if from_instant > to_instant:
        raise BadRequestError("'from' must be before 'to'")

    if aggregate is not None:
        if aggregate not in VALID_AGGREGATES:
            raise BadRequestError("'aggregate' must be one of: " + ", ".join(VALID_AGGREGATES))
        if window is None or not VALID_WINDOW.match(window):
            raise BadRequestError("'window' must be a valid duration like 1m, 5m, 1h, 1d")

    return from_instant, to_instant


def _parse_instant(value: str) -> datetime | None:
    """Instant.parse equivalent — an offset is mandatory, so naive values are rejected."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed
