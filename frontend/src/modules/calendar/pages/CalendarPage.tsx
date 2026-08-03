import { usePolling } from '@/hooks/usePolling'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvents } from '../api/calendarEvents'
import { CalendarEventRow } from '../components/CalendarEventRow'
import { NewCalendarEventForm } from '../components/NewCalendarEventForm'
import type { CalendarEvent, CalendarEventRequest } from '../types/calendarEvent'

const REFRESH_INTERVAL_MS = 15_000

export function CalendarPage() {
  const { data: events, error, loading, refresh } = usePolling(getCalendarEvents, REFRESH_INTERVAL_MS)

  const handleCreate = async (request: CalendarEventRequest) => {
    await createCalendarEvent(request)
    refresh()
  }

  const handleDelete = async (event: CalendarEvent) => {
    await deleteCalendarEvent(event.id)
    refresh()
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader title="Calendar" />

      <div className="mb-6 max-w-2xl">
        <NewCalendarEventForm onCreate={handleCreate} />
      </div>

      {loading && !events && <Loading label="Fetching calendar…" />}
      {error && <p className="text-danger">Failed to load calendar: {error.message}</p>}
      {events && events.length === 0 && <p className="text-ink-muted">No upcoming events.</p>}
      {events && events.length > 0 && (
        <ul className="max-w-2xl space-y-1">
          {events.map((event) => (
            <CalendarEventRow key={event.id} event={event} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
