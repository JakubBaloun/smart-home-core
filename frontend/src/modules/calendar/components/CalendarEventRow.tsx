import { Button } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import type { CalendarEvent, Person } from '../types/calendarEvent'

const PERSON_LABELS: Record<Person, string> = {
  KUBA: 'Kuba',
  PETA: 'Péťa',
  BOTH: 'Both',
}

function formatDate(eventDate: string): string {
  const [year, month, day] = eventDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function formatTime(eventTime: string): string {
  return eventTime.slice(0, 5)
}

export function CalendarEventRow({
  event,
  onDelete,
}: {
  event: CalendarEvent
  onDelete: (event: CalendarEvent) => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-overlay">
      <div className="w-16 shrink-0 font-mono text-xs tabular-nums text-ink-muted">
        <div>{formatDate(event.eventDate)}</div>
        <div>{event.eventTime ? formatTime(event.eventTime) : 'All day'}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-ink">{event.title}</span>
          {event.person && <Chip className="shrink-0">{PERSON_LABELS[event.person]}</Chip>}
        </div>
        {event.note && <p className="truncate text-xs text-ink-faint">{event.note}</p>}
      </div>
      <Button
        size="md"
        variant="danger"
        onClick={() => onDelete(event)}
        aria-label={`Delete ${event.title}`}
        className="shrink-0 px-3"
      >
        ✕
      </Button>
    </li>
  )
}
