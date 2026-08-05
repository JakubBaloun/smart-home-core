import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LightControls } from './LightControls'
import { sendCommand } from '../api/devices'
import type { Device } from '../types/device'

vi.mock('../api/devices', () => ({
  sendCommand: vi.fn(),
}))

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ieeeAddress: '0x1',
    friendlyName: 'Living room light',
    type: 'LIGHT',
    vendor: null,
    model: null,
    available: true,
    state: 'ON',
    brightness: 180,
    colorTemp: 320,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('LightControls', () => {
  beforeEach(() => {
    vi.mocked(sendCommand).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders both sliders seeded from the device brightness/colorTemp', () => {
    render(<LightControls device={device({ brightness: 127, colorTemp: 400 })} />)

    expect(screen.getByLabelText('Jas')).toHaveValue('127')
    expect(screen.getByLabelText('Barva světla')).toHaveValue('400')
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it('sends setBrightness only once the brightness slider is released', () => {
    render(<LightControls device={device()} />)
    const slider = screen.getByLabelText('Jas')

    fireEvent.change(slider, { target: { value: '200' } })
    expect(sendCommand).not.toHaveBeenCalled()

    fireEvent.mouseUp(slider, { target: { value: '200' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setBrightness',
      payload: { brightness: 200 },
    })
  })

  it('sends setColorTemp only once the color-temperature slider is released', () => {
    render(<LightControls device={device()} />)
    const slider = screen.getByLabelText('Barva světla')

    fireEvent.change(slider, { target: { value: '450' } })
    expect(sendCommand).not.toHaveBeenCalled()

    fireEvent.mouseUp(slider, { target: { value: '450' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setColorTemp',
      payload: { color_temp: 450 },
    })
  })

  it('supports touch release as well as mouse release', () => {
    render(<LightControls device={device()} />)
    const slider = screen.getByLabelText('Jas')

    fireEvent.change(slider, { target: { value: '90' } })
    fireEvent.touchEnd(slider, { target: { value: '90' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setBrightness',
      payload: { brightness: 90 },
    })
  })

  it('disables both sliders when the device is off', () => {
    render(<LightControls device={device({ state: 'OFF' })} />)

    expect(screen.getByLabelText('Jas')).toBeDisabled()
    expect(screen.getByLabelText('Barva světla')).toBeDisabled()
  })

  it('leaves both sliders enabled when the device is on', () => {
    render(<LightControls device={device({ state: 'ON' })} />)

    expect(screen.getByLabelText('Jas')).toBeEnabled()
    expect(screen.getByLabelText('Barva světla')).toBeEnabled()
  })
})
