"""Business logic for the calendar module."""

import logging
from datetime import datetime, timezone

from app.calendar import mappers
from app.calendar.repository import calendar_event_repository
from app.calendar.schemas import CalendarEventRequest, CalendarEventResponse
from app.common.exceptions import ResourceNotFoundError
from app.db import read_session, transaction

log = logging.getLogger(__name__)


class CalendarEventService:
    def list_events(self) -> list[CalendarEventResponse]:
        with read_session() as session:
            events = calendar_event_repository.list_all(session)
            log.debug("Retrieved %d calendar event(s)", len(events))
            return [mappers.to_response(e) for e in events]

    def create_event(self, request: CalendarEventRequest) -> CalendarEventResponse:
        log.info("Creating calendar event '%s'", request.title)
        with transaction() as session:
            event = mappers.to_entity(request)
            calendar_event_repository.save(event, session)
            log.info("Calendar event '%s' created with id %s", event.title, event.id)
            return mappers.to_response(event)

    def update_event(self, event_id: int, request: CalendarEventRequest) -> CalendarEventResponse:
        log.info("Updating calendar event with id %s", event_id)
        with transaction() as session:
            event = calendar_event_repository.find_by_id(event_id, session)
            if event is None:
                raise ResourceNotFoundError("CalendarEvent", event_id)
            event.title = request.title
            event.person = request.person.value if request.person else None
            event.event_date = request.eventDate
            event.event_time = request.eventTime
            event.note = request.note
            event.updated_at = datetime.now(timezone.utc)
            calendar_event_repository.save(event, session)
            return mappers.to_response(event)

    def delete_event(self, event_id: int) -> None:
        log.info("Deleting calendar event with id %s", event_id)
        with transaction() as session:
            event = calendar_event_repository.find_by_id(event_id, session)
            if event is None:
                raise ResourceNotFoundError("CalendarEvent", event_id)
            calendar_event_repository.delete(event, session)


calendar_event_service = CalendarEventService()
