import { useState, type FormEvent } from 'react'
import { Button } from '@/ui/Button'
import { fieldClasses } from '@/ui/field'
import { PersonSelect } from './PersonSelect'
import type { CalendarEventRequest, Person } from '../types/calendarEvent'

export function NewCalendarEventForm({ onCreate }: { onCreate: (request: CalendarEventRequest) => void }) {
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [person, setPerson] = useState<Person | null>(null)
  const [note, setNote] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !eventDate) return
    onCreate({
      title: title.trim(),
      person,
      eventDate,
      eventTime: eventTime || null,
      note: note.trim() || null,
    })
    setTitle('')
    setEventTime('')
    setNote('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className={`min-w-0 flex-1 ${fieldClasses}`}
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className={fieldClasses}
        />
        <input
          type="time"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          className={fieldClasses}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PersonSelect value={person} onChange={setPerson} />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className={`min-w-0 flex-1 ${fieldClasses}`}
        />
        <Button type="submit" variant="primary">
          Add
        </Button>
      </div>
    </form>
  )
}
