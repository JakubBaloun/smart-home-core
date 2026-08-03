import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomOverviewCard } from './RoomOverviewCard'
import type { RoomReading } from '@/modules/roomMap/api/roomMap'
import type { RoomConfig } from '@/modules/roomMap/config/rooms'

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'office',
    label: 'Pracovna',
    sensorIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb'],
    rects: [{ top: 0, left: 0, width: 100, height: 100 }],
    ...overrides,
  }
}

describe('RoomOverviewCard', () => {
  it('shows temperature, humidity, and a closed badge when all three are reported', () => {
    const reading: RoomReading = { room: room(), temperature: 21.4, humidity: 48, contact: true }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('21.4°')).toBeInTheDocument()
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('shows an open badge when contact is false', () => {
    const reading: RoomReading = { room: room(), contact: false }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('otevřeno')).toBeInTheDocument()
  })

  it('omits humidity and the door badge when only temperature is reported', () => {
    const reading: RoomReading = { room: room(), temperature: 19.0 }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('19.0°')).toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('zavřeno')).not.toBeInTheDocument()
    expect(screen.queryByText('otevřeno')).not.toBeInTheDocument()
  })

  it('renders a muted "no sensor" state when nothing is reported', () => {
    const reading: RoomReading = { room: room({ sensorIeeeAddresses: [] }) }

    render(<RoomOverviewCard reading={reading} />)

    expect(screen.getByText('Pracovna')).toBeInTheDocument()
    expect(screen.getByText('bez senzoru')).toBeInTheDocument()
  })
})
