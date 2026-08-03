"""Mapper functions between CalendarEvent and its Pydantic DTOs."""

from app.calendar.models import CalendarEvent, Person
from app.calendar.schemas import CalendarEventRequest, CalendarEventResponse


def to_entity(request: CalendarEventRequest) -> CalendarEvent:
    return CalendarEvent(
        title=request.title,
        person=request.person.value if request.person else None,
        event_date=request.eventDate,
        event_time=request.eventTime,
        note=request.note,
    )


def to_response(event: CalendarEvent) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event.id,
        title=event.title,
        person=Person(event.person) if event.person else None,
        eventDate=event.event_date,
        eventTime=event.event_time,
        note=event.note,
        createdAt=event.created_at,
        updatedAt=event.updated_at,
    )
