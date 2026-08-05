import { useEffect, useState, type CSSProperties } from 'react'
import { sendCommand } from '../api/devices'
import type { Device } from '../types/device'

const BRIGHTNESS_MIN = 0
const BRIGHTNESS_MAX = 254
const COLOR_TEMP_MIN = 153 // cool white (~6500K)
const COLOR_TEMP_MAX = 500 // warm white (~2000K)

interface LightControlsProps {
  device: Device
  disabled?: boolean
}

export function LightControls({ device, disabled }: LightControlsProps) {
  const [brightness, setBrightness] = useState(device.brightness ?? 180)
  const [colorTemp, setColorTemp] = useState(device.colorTemp ?? 320)
  const [dragging, setDragging] = useState(false)

  // The poll refreshes device.brightness/colorTemp every 15s. Only adopt the server value
  // while the user isn't actively dragging, otherwise a mid-gesture poll would yank the thumb
  // back under their finger.
  useEffect(() => {
    if (dragging) return
    if (device.brightness !== null) setBrightness(device.brightness)
  }, [device.brightness, dragging])

  useEffect(() => {
    if (dragging) return
    if (device.colorTemp !== null) setColorTemp(device.colorTemp)
  }, [device.colorTemp, dragging])

  const isOff = device.state !== 'ON'
  // Adjusting a light that's off is confusing UX — the slider would move but nothing on the
  // device visibly changes until it's turned on, so both controls are dimmed and inert.
  const isDisabled = disabled || isOff

  const commitBrightness = (value: number) => {
    setDragging(false)
    void sendCommand(device.id, { command: 'setBrightness', payload: { brightness: value } })
  }

  const commitColorTemp = (value: number) => {
    setDragging(false)
    void sendCommand(device.id, { command: 'setColorTemp', payload: { color_temp: value } })
  }

  const brightnessPercent = Math.round(
    ((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100,
  )
  const brightnessFillStyle = { '--slider-fill': `${brightnessPercent}%` } as CSSProperties

  return (
    <div className="mt-4 space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Jas</span>
          <span className="font-mono tabular-nums text-ink-muted">{brightnessPercent} %</span>
        </div>
        <input
          type="range"
          aria-label="Jas"
          min={BRIGHTNESS_MIN}
          max={BRIGHTNESS_MAX}
          value={brightness}
          disabled={isDisabled}
          onChange={(e) => setBrightness(Number(e.currentTarget.value))}
          onPointerDown={() => setDragging(true)}
          onMouseUp={(e) => commitBrightness(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitBrightness(Number(e.currentTarget.value))}
          style={brightnessFillStyle}
          className={`light-slider light-slider-brightness w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        />
      </div>

      <div>
        <div className="mb-2 text-sm text-ink-muted">Barva světla</div>
        <input
          type="range"
          aria-label="Barva světla"
          min={COLOR_TEMP_MIN}
          max={COLOR_TEMP_MAX}
          value={colorTemp}
          disabled={isDisabled}
          onChange={(e) => setColorTemp(Number(e.currentTarget.value))}
          onPointerDown={() => setDragging(true)}
          onMouseUp={(e) => commitColorTemp(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitColorTemp(Number(e.currentTarget.value))}
          className={`light-slider light-slider-color-temp w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        />
        <div className="mt-1 flex justify-between text-xs text-ink-faint">
          <span>studená</span>
          <span>teplá</span>
        </div>
      </div>
    </div>
  )
}
