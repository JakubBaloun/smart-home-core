import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RoomOverviewCard } from './RoomOverviewCard'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'
import type { RoomConfig } from '@/modules/roomMap/config/rooms'

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'office',
    label: 'Pracovna',
    deviceIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb'],
    rects: [{ top: 0, left: 0, width: 100, height: 100 }],
    ...overrides,
  }
}

function renderCard(reading: RoomReading, linkable?: boolean) {
  return render(
    <MemoryRouter>
      <RoomOverviewCard reading={reading} linkable={linkable} />
    </MemoryRouter>,
  )
}

describe('RoomOverviewCard', () => {
  it('shows temperature, humidity, and a closed badge when all three are reported', () => {
    const reading: RoomReading = { room: room(), temperature: 21.4, humidity: 48, contact: true }

    renderCard(reading)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('21.4°')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows an open badge when contact is false', () => {
    const reading: RoomReading = { room: room(), contact: false }

    renderCard(reading)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('omits humidity and the door badge when only temperature is reported', () => {
    const reading: RoomReading = { room: room(), temperature: 19.0 }

    renderCard(reading)

    expect(screen.getByText('19.0°')).toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('zavřeno')).not.toBeInTheDocument()
    expect(screen.queryByText('otevřeno')).not.toBeInTheDocument()
  })

  it('renders a muted "no sensor" state when nothing is reported', () => {
    const reading: RoomReading = { room: room({ deviceIeeeAddresses: [] }) }

    renderCard(reading)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('bez senzoru')).toBeInTheDocument()
  })

  it('links to the room detail page by default', () => {
    const reading: RoomReading = { room: room() }

    renderCard(reading)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/room/office')
  })

  it('renders as a plain, non-navigating container when linkable is false', () => {
    const reading: RoomReading = { room: room() }

    renderCard(reading, false)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Pracovna')).toBeInTheDocument()
  })
})
