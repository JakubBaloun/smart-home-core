"""Mirror of TelemetryServiceTest — field normalization and identifier sanitizing."""

import pytest

from app.telemetry.service import normalize_fields, sanitize


def test_numbers_are_coerced_to_float():
    assert normalize_fields({"temperature": 22, "humidity": 55.5}) == {
        "temperature": 22.0,
        "humidity": 55.5,
    }


def test_booleans_stay_boolean():
    normalized = normalize_fields({"contact": True})
    assert normalized == {"contact": True}
    assert isinstance(normalized["contact"], bool)


def test_strings_and_none_are_skipped():
    assert normalize_fields({"state": "ON", "missing": None, "battery": 90}) == {"battery": 90.0}


def test_sanitize_strips_unsupported_characters():
    assert sanitize("living room/light!") == "livingroomlight"
    assert sanitize("temp_sensor-1") == "temp_sensor-1"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_sanitize_rejects_blank(value):
    with pytest.raises(ValueError):
        sanitize(value)
