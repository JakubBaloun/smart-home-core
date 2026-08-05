import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

  // Read (but never a dependency of) the resync effects below: a drag/keyboard gesture in
  // progress must suppress resync without itself being a trigger for it — see the comment on
  // those effects.
  const draggingRef = useRef(false)
  const lastSentBrightnessRef = useRef<number | null>(null)
  const lastSentColorTempRef = useRef<number | null>(null)

  // The poll refreshes device.brightness/colorTemp every 15s, and sendCommand doesn't await a
  // state readback, so a command we just sent can take up to 15s to be reflected in `device`.
  // These effects only run when the device prop itself changes — not when a gesture ends —
  // so committing never causes an immediate resync from whatever (possibly stale, pre-gesture)
  // value the prop still held at that moment. They also ignore a mid-gesture prop update via
  // draggingRef, and ignore a value that merely confirms the command we ourselves last sent.
  useEffect(() => {
    if (draggingRef.current) return
    if (device.brightness === null) return
    if (device.brightness === lastSentBrightnessRef.current) return
    setBrightness(device.brightness)
  }, [device.brightness])

  useEffect(() => {
    if (draggingRef.current) return
    if (device.colorTemp === null) return
    if (device.colorTemp === lastSentColorTempRef.current) return
    setColorTemp(device.colorTemp)
  }, [device.colorTemp])

  const isOff = device.state !== 'ON'
  // Adjusting a light that's off is confusing UX — the slider would move but nothing on the
  // device visibly changes until it's turned on, so both controls are dimmed and inert.
  const isDisabled = disabled || isOff

  const beginGesture = () => {
    draggingRef.current = true
  }

  const commitBrightness = (value: number) => {
    draggingRef.current = false
    lastSentBrightnessRef.current = value
    void sendCommand(device.id, { command: 'setBrightness', payload: { brightness: value } })
  }

  const commitColorTemp = (value: number) => {
    draggingRef.current = false
    lastSentColorTempRef.current = value
    void sendCommand(device.id, { command: 'setColorTemp', payload: { color_temp: value } })
  }

  const brightnessPercent = Math.round(
    ((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100,
  )
  const brightnessFillStyle = { '--slider-fill': `${brightnessPercent}%` } as CSSProperties
  const colorTempKelvin = Math.round(1_000_000 / colorTemp)

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
          onPointerDown={beginGesture}
          onKeyDown={beginGesture}
          onMouseUp={(e) => commitBrightness(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitBrightness(Number(e.currentTarget.value))}
          onKeyUp={(e) => commitBrightness(Number(e.currentTarget.value))}
          style={brightnessFillStyle}
          className={`light-slider light-slider-brightness w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Barva světla</span>
          <span className="font-mono tabular-nums text-ink-muted">{colorTempKelvin} K</span>
        </div>
        <input
          type="range"
          aria-label="Barva světla"
          min={COLOR_TEMP_MIN}
          max={COLOR_TEMP_MAX}
          value={colorTemp}
          disabled={isDisabled}
          onChange={(e) => setColorTemp(Number(e.currentTarget.value))}
          onPointerDown={beginGesture}
          onKeyDown={beginGesture}
          onMouseUp={(e) => commitColorTemp(Number(e.currentTarget.value))}
          onTouchEnd={(e) => commitColorTemp(Number(e.currentTarget.value))}
          onKeyUp={(e) => commitColorTemp(Number(e.currentTarget.value))}
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
