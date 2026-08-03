import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from './calendarEvents'
import type { CalendarEventRequest } from '../types/calendarEvent'

describe('calendar events api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getCalendarEvents requests the plain endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    await getCalendarEvents()

    expect(fetch).toHaveBeenCalledWith('/api/calendar-events', expect.any(Object))
  })

  it('createCalendarEvent posts the event payload', async () => {
    const request: CalendarEventRequest = {
      title: 'Dentist',
      person: 'KUBA',
      eventDate: '2026-08-05',
      eventTime: '09:30:00',
      note: null,
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await createCalendarEvent(request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/calendar-events',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    )
  })

  it('updateCalendarEvent puts the event payload', async () => {
    const request: CalendarEventRequest = {
      title: 'Dentist',
      person: 'BOTH',
      eventDate: '2026-08-05',
      eventTime: null,
      note: 'Bring insurance card',
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await updateCalendarEvent(1, request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/calendar-events/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(request) }),
    )
  })

  it('deleteCalendarEvent sends a DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteCalendarEvent(1)

    expect(fetch).toHaveBeenCalledWith('/api/calendar-events/1', expect.objectContaining({ method: 'DELETE' }))
  })
})
