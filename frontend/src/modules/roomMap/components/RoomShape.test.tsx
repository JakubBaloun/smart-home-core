import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomShape } from './RoomShape'
import type { RoomReading } from '../api/roomMap'
import type { RoomConfig } from '../config/rooms'

const room: RoomConfig = {
  id: 'office',
  label: 'Pracovna',
  sensorFriendlyNames: ['Bedroom temp'],
  rects: [{ top: 0, left: 66.6, width: 33.4, height: 100 }],
}

const lShapedRoom: RoomConfig = {
  id: 'hallway',
  label: 'Chodba',
  sensorFriendlyNames: [],
  rects: [
    { top: 75, left: 26.7, width: 20, height: 25 },
    { top: 37.5, left: 42.7, width: 4, height: 37.5 },
  ],
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
    const reading: RoomReading = { room: { ...room, sensorFriendlyNames: [] } }

    render(<RoomShape reading={reading} />)

    const shape = screen.getByTestId('room-shape')
    expect(shape).toHaveAttribute('data-has-data', 'false')
    expect(shape.textContent).toBe('')
  })

  it('renders one box per rect for a multi-rect (L-shaped) room, with the reading only in the first', () => {
    const reading: RoomReading = { room: lShapedRoom }

    render(<RoomShape reading={reading} />)

    const shapes = screen.getAllByTestId('room-shape')
    expect(shapes).toHaveLength(2)
    expect(shapes[0]).toHaveStyle({ top: '75%', left: '26.7%', width: '20%', height: '25%' })
    expect(shapes[1]).toHaveStyle({ top: '37.5%', left: '42.7%', width: '4%', height: '37.5%' })
  })

  it('omits the border on a rect edge listed in openEdges, an open passage with no wall', () => {
    const roomWithOpenEdge: RoomConfig = {
      ...room,
      rects: [{ top: 0, left: 66.6, width: 33.4, height: 100, openEdges: ['top', 'left'] }],
    }
    const reading: RoomReading = { room: roomWithOpenEdge }

    render(<RoomShape reading={reading} />)

    const shape = screen.getByTestId('room-shape')
    expect(shape).not.toHaveClass('border-t')
    expect(shape).not.toHaveClass('border-l')
    expect(shape).toHaveClass('border-r')
    expect(shape).toHaveClass('border-b')
  })
})
