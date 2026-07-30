"""Jackson-compatible datetime serialization.

Quarkus emits two different fraction formats and the frontend sees both:
  * `OffsetDateTime` (device/recipe timestamps) -> ISO_OFFSET_DATE_TIME, which
    prints the fewest digits needed: `17:49:58.22422Z`.
  * `Instant` (telemetry) -> ISO_INSTANT, which pads to a multiple of three:
    `17:50:00.268Z`.
Pydantic would print a fixed six digits for both.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _base(value: datetime) -> tuple[str, int]:
    utc = value.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S"), utc.microsecond


def _offset_date_time(value: datetime) -> str:
    head, micro = _base(value)
    if micro == 0:
        return f"{head}Z"
    return f"{head}.{micro:06d}".rstrip("0") + "Z"


def _instant(value: datetime) -> str:
    head, micro = _base(value)
    if micro == 0:
        return f"{head}Z"
    digits = f"{micro:06d}"
    if micro % 1000 == 0:
        digits = digits[:3]
    return f"{head}.{digits}Z"


OffsetDateTime = Annotated[datetime, PlainSerializer(_offset_date_time, return_type=str)]
Instant = Annotated[datetime, PlainSerializer(_instant, return_type=str)]
