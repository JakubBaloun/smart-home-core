import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomTile } from './RoomTile'
import type { RoomReading } from '../api/roomMap'
import type { RoomConfig } from '../config/rooms'

const room: RoomConfig = { id: 'bedroom', label: 'Ložnice', sensorFriendlyName: 'smoke_thermo', area: 'bedroom' }

describe('RoomTile', () => {
  it('shows temperature and humidity when both are present', () => {
    const reading: RoomReading = { room, temperature: 21.5, humidity: 44 }

    render(<RoomTile reading={reading} />)

    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByText('21.5°C')).toBeInTheDocument()
    expect(screen.getByText('44%')).toBeInTheDocument()
  })

  it('shows only temperature when humidity is missing', () => {
    const reading: RoomReading = { room, temperature: 21.5 }

    render(<RoomTile reading={reading} />)

    expect(screen.getByText('21.5°C')).toBeInTheDocument()
    expect(screen.queryByText('%', { exact: false })).not.toBeInTheDocument()
  })

  it('renders a dimmed, data-less tile when there is no reading at all', () => {
    const reading: RoomReading = { room: { ...room, sensorFriendlyName: null } }

    render(<RoomTile reading={reading} />)

    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByTestId('room-tile')).toHaveAttribute('data-has-data', 'false')
  })
})
