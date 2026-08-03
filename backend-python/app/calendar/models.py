"""SQLAlchemy entities for the calendar module."""

from datetime import date, datetime, time, timezone
from enum import Enum

from sqlalchemy import BigInteger, Date, DateTime, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Person(str, Enum):
    KUBA = "KUBA"
    PETA = "PETA"
    BOTH = "BOTH"


class CalendarEvent(Base):
    __tablename__ = "calendar_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    person: Mapped[str | None] = mapped_column(String(10))
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_time: Mapped[time | None] = mapped_column(Time)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
