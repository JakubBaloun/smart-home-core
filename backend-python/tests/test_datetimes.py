"""Jackson emits two different fraction formats; both were observed live on the
Quarkus backend (`...58.22422Z` for OffsetDateTime, `...00.268Z` for Instant)."""

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import BaseModel

from app.common.datetimes import Instant, OffsetDateTime


class _Model(BaseModel):
    offset: OffsetDateTime
    instant: Instant


def render(value: datetime) -> tuple[str, str]:
    dumped = _Model(offset=value, instant=value).model_dump(mode="json")
    return dumped["offset"], dumped["instant"]


@pytest.mark.parametrize(
    ("micro", "expected_offset", "expected_instant"),
    [
        (0, "Z", "Z"),
        (268000, ".268Z", ".268Z"),
        (224220, ".22422Z", ".224220Z"),
        (224218, ".224218Z", ".224218Z"),
        (500000, ".5Z", ".500Z"),
    ],
)
def test_fraction_formats(micro: int, expected_offset: str, expected_instant: str):
    value = datetime(2026, 7, 30, 17, 49, 58, micro, tzinfo=timezone.utc)
    assert render(value) == (
        f"2026-07-30T17:49:58{expected_offset}",
        f"2026-07-30T17:49:58{expected_instant}",
    )


def test_non_utc_input_is_converted_to_z():
    value = datetime(2026, 7, 30, 19, 49, 58, tzinfo=timezone(timedelta(hours=2)))
    assert render(value) == ("2026-07-30T17:49:58Z", "2026-07-30T17:49:58Z")
