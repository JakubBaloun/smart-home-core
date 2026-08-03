"""REST layer for /api/calendar-events."""

import logging

from fastapi import APIRouter, Response

from app.calendar.schemas import CalendarEventRequest, CalendarEventResponse
from app.calendar.service import calendar_event_service

log = logging.getLogger(__name__)

calendar_router = APIRouter(prefix="/api/calendar-events", tags=["calendar-events"])


@calendar_router.get("", response_model=list[CalendarEventResponse])
def list_calendar_events() -> list[CalendarEventResponse]:
    log.info("Request received to list calendar events")
    return calendar_event_service.list_events()


@calendar_router.post("", response_model=CalendarEventResponse)
def create_calendar_event(request: CalendarEventRequest) -> CalendarEventResponse:
    log.info("Request received to create calendar event '%s'", request.title)
    return calendar_event_service.create_event(request)


@calendar_router.put("/{event_id}", response_model=CalendarEventResponse)
def update_calendar_event(event_id: int, request: CalendarEventRequest) -> CalendarEventResponse:
    log.info("Request received to update calendar event with id: %s", event_id)
    return calendar_event_service.update_event(event_id, request)


@calendar_router.delete("/{event_id}", status_code=204, response_class=Response)
def delete_calendar_event(event_id: int) -> Response:
    log.info("Request received to delete calendar event with id: %s", event_id)
    calendar_event_service.delete_event(event_id)
    return Response(status_code=204)
