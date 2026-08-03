"""Data access for calendar_event."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calendar.models import CalendarEvent


class CalendarEventRepository:
    def find_by_id(self, event_id: int, session: Session) -> CalendarEvent | None:
        return session.get(CalendarEvent, event_id)

    def list_all(self, session: Session) -> list[CalendarEvent]:
        stmt = select(CalendarEvent).order_by(
            CalendarEvent.event_date.asc(),
            CalendarEvent.event_time.asc().nulls_first(),
            CalendarEvent.id.asc(),
        )
        return list(session.scalars(stmt))

    def save(self, event: CalendarEvent, session: Session) -> None:
        session.add(event)
        session.flush()

    def delete(self, event: CalendarEvent, session: Session) -> None:
        session.delete(event)
        session.flush()


calendar_event_repository = CalendarEventRepository()
