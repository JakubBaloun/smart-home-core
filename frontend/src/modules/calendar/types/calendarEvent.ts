export type Person = 'KUBA' | 'PETA' | 'BOTH'

export interface CalendarEvent {
  id: number
  title: string
  person: Person | null
  eventDate: string
  eventTime: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CalendarEventRequest {
  title: string
  person: Person | null
  eventDate: string
  eventTime: string | null
  note: string | null
}
