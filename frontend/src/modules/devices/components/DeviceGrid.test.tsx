import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DeviceGrid } from './DeviceGrid'
import type { DeviceReading } from '../api/deviceReadings'
import type { Device } from '../types/device'

function device(overrides: Partial<Device>): Device {
  return {
    id: 1,
    ieeeAddress: '0x1',
    friendlyName: 'device',
    type: 'LIGHT',
    vendor: null,
    model: null,
    available: true,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderGrid(readings: DeviceReading[]) {
  return render(
    <MemoryRouter>
      <DeviceGrid readings={readings} />
    </MemoryRouter>,
  )
}

describe('DeviceGrid', () => {
  it('groups devices by type under section headers, in a fixed order', () => {
    const readings: DeviceReading[] = [
      { device: device({ id: 1, friendlyName: 'lamp', type: 'LIGHT' }) },
      { device: device({ id: 2, friendlyName: 'temp sensor', type: 'SENSOR' }) },
      { device: device({ id: 3, friendlyName: 'switch', type: 'SWITCH' }) },
    ]

    renderGrid(readings)

    const headers = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headers).toEqual(['Světla', 'Spínače a zásuvky', 'Senzory'])
  })

  it('renders no header for a type with zero devices', () => {
    renderGrid([{ device: device({ id: 1, friendlyName: 'lamp', type: 'LIGHT' }) }])

    expect(screen.queryByText('Senzory')).not.toBeInTheDocument()
    expect(screen.queryByText('Ostatní')).not.toBeInTheDocument()
  })

  it('shows a message when there are no devices at all', () => {
    renderGrid([])

    expect(screen.getByText('No devices found.')).toBeInTheDocument()
  })

  it('is expanded by default and can be collapsed and re-expanded', async () => {
    renderGrid([{ device: device({ id: 1, friendlyName: 'lamp', type: 'LIGHT' }) }])

    expect(screen.getByText('Světla')).toBeInTheDocument()
    expect(screen.getByText('Zařízení (1)')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Zařízení (1)'))
    expect(screen.queryByText('Světla')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Zařízení (1)'))
    expect(screen.getByText('Světla')).toBeInTheDocument()
  })
})
