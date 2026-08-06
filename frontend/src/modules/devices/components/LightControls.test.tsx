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

  it('does not snap back to a stale polled value after a drag commits', () => {
    const { rerender } = render(<LightControls device={device({ brightness: 180 })} />)
    const slider = screen.getByLabelText('Jas')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '200' } })
    fireEvent.mouseUp(slider, { target: { value: '200' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setBrightness',
      payload: { brightness: 200 },
    })

    // Simulate a 15s poll resolving with the pre-drag value, which raced ahead of the
    // command we just sent and lands after the drag has already ended.
    rerender(<LightControls device={device({ brightness: 180 })} />)

    expect(slider).toHaveValue('200')
  })

  it('commits the brightness value on keyboard release, not just pointer release', () => {
    render(<LightControls device={device()} />)
    const slider = screen.getByLabelText('Jas')

    fireEvent.keyDown(slider)
    fireEvent.change(slider, { target: { value: '210' } })
    expect(sendCommand).not.toHaveBeenCalled()

    fireEvent.keyUp(slider, { target: { value: '210' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setBrightness',
      payload: { brightness: 210 },
    })
  })

  it('commits the color-temp value on keyboard release, not just pointer release', () => {
    render(<LightControls device={device()} />)
    const slider = screen.getByLabelText('Barva světla')

    fireEvent.keyDown(slider)
    fireEvent.change(slider, { target: { value: '410' } })
    expect(sendCommand).not.toHaveBeenCalled()

    fireEvent.keyUp(slider, { target: { value: '410' } })

    expect(sendCommand).toHaveBeenCalledWith(1, {
      command: 'setColorTemp',
      payload: { color_temp: 410 },
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

  it('does not render the Bílá/Barva toggle when the device has no color support', () => {
    render(<LightControls device={device({ supportsColor: false })} />)
    expect(screen.queryByRole('tab', { name: 'Barva' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Bílá' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Jas')).toBeInTheDocument()
    expect(screen.getByLabelText('Barva světla')).toBeInTheDocument()
  })

  it('renders the Bílá/Barva toggle when the device supports color', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'color_temp', hue: 200, saturation: 80 })}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Bílá' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Barva' })).toBeInTheDocument()
    // colorMode !== 'hs' => Bílá is the default tab
    expect(screen.getByLabelText('Barva světla')).toBeInTheDocument()
    // Exact name match, not a /barva/i substring: the pre-existing color-temp slider is
    // labelled "Barva světla" (unchanged) and would otherwise also match role=slider.
    expect(screen.queryByRole('slider', { name: 'Barva' })).not.toBeInTheDocument()
  })

  it('defaults to the Barva tab when colorMode is "hs"', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'hs', hue: 200, saturation: 80 })}
      />,
    )
    expect(screen.queryByLabelText('Barva světla')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Barva' })).toBeInTheDocument()
  })

  it('does not send any command when the user only switches tabs', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'color_temp', hue: 200, saturation: 80 })}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Barva' }))
    expect(sendCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Bílá' }))
    expect(sendCommand).not.toHaveBeenCalled()
  })

  it('sends setColor when the color wheel commits', () => {
    render(
      <LightControls
        device={device({ supportsColor: true, colorMode: 'hs', hue: 200, saturation: 80 })}
      />,
    )
    const wheel = screen.getByRole('slider', { name: 'Barva' })
    fireEvent.pointerDown(wheel, { clientX: 50, clientY: 50, pointerId: 1 })
    fireEvent.pointerUp(wheel, { clientX: 50, clientY: 50, pointerId: 1 })

    expect(sendCommand).toHaveBeenCalledTimes(1)
    const call = vi.mocked(sendCommand).mock.calls[0]
    expect(call[0]).toBe(1)
    expect(call[1].command).toBe('setColor')
    const payload = call[1].payload as { hue: number; saturation: number }
    expect(typeof payload.hue).toBe('number')
    expect(typeof payload.saturation).toBe('number')
    expect(payload.hue).toBeGreaterThanOrEqual(0)
    expect(payload.hue).toBeLessThanOrEqual(360)
    expect(payload.saturation).toBeGreaterThanOrEqual(0)
    expect(payload.saturation).toBeLessThanOrEqual(100)
  })
})
