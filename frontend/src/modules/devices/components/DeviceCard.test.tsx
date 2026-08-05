import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DeviceCard } from './DeviceCard'
import type { Device } from '../types/device'

const baseDevice: Device = {
  id: 1,
  ieeeAddress: '0x00124b0'.padEnd(18, '0'),
  friendlyName: 'living_room_light',
  type: 'LIGHT',
  vendor: 'IKEA',
  model: 'TRADFRI',
  available: true,
  state: null,
  brightness: null,
  colorTemp: null,
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderCard(device: Device, liveValue?: string) {
  return render(
    <MemoryRouter>
      <DeviceCard device={device} liveValue={liveValue} />
    </MemoryRouter>,
  )
}

describe('DeviceCard', () => {
  it('shows the friendly name and vendor/model', () => {
    renderCard(baseDevice)

    expect(screen.getByText('living_room_light')).toBeInTheDocument()
    expect(screen.getByText('IKEA TRADFRI')).toBeInTheDocument()
  })

  it('links to the device detail page', () => {
    renderCard(baseDevice)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/device/1')
  })

  it('renders an offline indicator when the device is unavailable', () => {
    renderCard({ ...baseDevice, available: false })

    expect(screen.getByTitle('Offline')).toBeInTheDocument()
  })

  it('shows the live sensor value instead of last-seen when present', () => {
    renderCard({ ...baseDevice, type: 'SENSOR' }, '21.5°C · 44%')

    expect(screen.getByText('21.5°C · 44%')).toBeInTheDocument()
  })

  it('falls back to last-seen when there is no live value', () => {
    renderCard(baseDevice)

    expect(screen.getByText('Just now')).toBeInTheDocument()
  })
})
