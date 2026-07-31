import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomShape } from './RoomShape'
import type { RoomReading } from '../api/roomMap'
import type { RoomConfig } from '../config/rooms'

const room: RoomConfig = {
  id: 'office',
  label: 'Pracovna',
  sensorFriendlyName: 'Bedroom temp',
  rect: { top: 0, left: 66.6, width: 33.4, height: 100 },
}

describe('RoomShape', () => {
  it('positions the room using its rect as percentage inset styles', () => {
    const reading: RoomReading = { room }

    render(<RoomShape reading={reading} />)

    const shape = screen.getByTestId('room-shape')
    expect(shape).toHaveStyle({ top: '0%', left: '66.6%', width: '33.4%', height: '100%' })
  })

  it('shows temperature and humidity when both are present, with no room label text', () => {
    const reading: RoomReading = { room, temperature: 21.5, humidity: 44 }

    render(<RoomShape reading={reading} />)

    expect(screen.getByText('21.5°C')).toBeInTheDocument()
    expect(screen.getByText('44%')).toBeInTheDocument()
    expect(screen.queryByText('Pracovna')).not.toBeInTheDocument()
  })

  it('renders no reading text and data-has-data="false" when there is no data', () => {
    const reading: RoomReading = { room: { ...room, sensorFriendlyName: null } }

    render(<RoomShape reading={reading} />)

    const shape = screen.getByTestId('room-shape')
    expect(shape).toHaveAttribute('data-has-data', 'false')
    expect(shape.textContent).toBe('')
  })
})
