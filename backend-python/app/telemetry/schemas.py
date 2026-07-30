from pydantic import BaseModel

from app.common.datetimes import Instant


class TelemetryPoint(BaseModel):
    time: Instant | None
    value: float | None


class TelemetryResponse(BaseModel):
    deviceName: str
    field: str
    points: list[TelemetryPoint]


class LatestTelemetryResponse(BaseModel):
    deviceName: str
    values: dict[str, float]
    lastUpdated: Instant | None
