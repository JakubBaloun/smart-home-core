import { apiFetch } from '@/api/client'
import type { CalendarEvent, CalendarEventRequest } from '../types/calendarEvent'

export function getCalendarEvents(): Promise<CalendarEvent[]> {
  return apiFetch<CalendarEvent[]>('/calendar-events')
}

export function createCalendarEvent(request: CalendarEventRequest): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>('/calendar-events', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateCalendarEvent(id: number, request: CalendarEventRequest): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>(`/calendar-events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteCalendarEvent(id: number): Promise<void> {
  return apiFetch<void>(`/calendar-events/${id}`, { method: 'DELETE' })
}
