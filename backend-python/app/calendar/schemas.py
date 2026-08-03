"""Pydantic schemas for the calendar endpoints."""

from datetime import date, time

from pydantic import BaseModel, field_validator

from app.calendar.models import Person
from app.common.datetimes import OffsetDateTime


def _not_blank(value: str, field: str) -> str:
    if value is None or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value


class CalendarEventRequest(BaseModel):
    title: str
    person: Person | None = None
    eventDate: date
    eventTime: time | None = None
    note: str | None = None

    @field_validator("title")
    @classmethod
    def _validate_title(cls, v: str) -> str:
        return _not_blank(v, "title")


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    person: Person | None
    eventDate: date
    eventTime: time | None
    note: str | None
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
