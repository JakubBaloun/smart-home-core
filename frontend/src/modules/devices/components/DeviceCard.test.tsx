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
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderCard(device: Device) {
  return render(
    <MemoryRouter>
      <DeviceCard device={device} />
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
})
