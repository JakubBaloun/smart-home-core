import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { sendCommand } from '../api/devices'
import type { Device } from '../types/device'
import { ChipButton } from '@/ui/Chip'
import { ColorWheel } from './ColorWheel'

const BRIGHTNESS_MIN = 0
const BRIGHTNESS_MAX = 254
const COLOR_TEMP_MIN = 153 // cool white (~6500K)
const COLOR_TEMP_MAX = 500 // warm white (~2000K)

type Tab = 'white' | 'color'

interface LightControlsProps {
  device: Device
  disabled?: boolean
}

export function LightControls({ device, disabled }: LightControlsProps) {
  const [brightness, setBrightness] = useState(device.brightness ?? 180)
  const [colorTemp, setColorTemp] = useState(device.colorTemp ?? 320)
  const [hue, setHue] = useState(device.hue ?? 0)
  const [saturation, setSaturation] = useState(device.saturation ?? 100)
  // Default tab follows the device's reported colorMode on mount only — the toggle itself
  // never sends a command, so there's nothing to resync afterwards.
  const [tab, setTab] = useState<Tab>(device.colorMode === 'hs' ? 'color' : 'white')

  // Read (but never a dependency of) the resync effects below: a drag/keyboard gesture in
  // progress must suppress resync without itself being a trigger for it — see the comment on
  // those effects.
  const draggingRef = useRef(false)
  const lastSentBrightnessRef = useRef<number | null>(null)
  const lastSentColorTempRef = useRef<number | null>(null)
  const lastSentHueRef = useRef<number | null>(null)
  const lastSentSaturationRef = useRef<number | null>(null)

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

  useEffect(() => {
    if (draggingRef.current) return
    if (device.hue === null || device.hue === undefined) return
    if (device.hue === lastSentHueRef.current) return
    setHue(device.hue)
  }, [device.hue])

  useEffect(() => {
    if (draggingRef.current) return
    if (device.saturation === null || device.saturation === undefined) return
    if (device.saturation === lastSentSaturationRef.current) return
    setSaturation(device.saturation)
  }, [device.saturation])

  const isOff = device.state !== 'ON'
  // Adjusting a light that's off is confusing UX — the slider would move but nothing on the
  // device visibly changes until it's turned on, so both controls are dimmed and inert.
  const isDisabled = disabled || isOff
  const showToggle = device.supportsColor === true

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

  const commitColor = (h: number, s: number) => {
    draggingRef.current = false
    lastSentHueRef.current = h
    lastSentSaturationRef.current = s
    void sendCommand(device.id, { command: 'setColor', payload: { hue: h, saturation: s } })
  }

  const brightnessPercent = Math.round(
    ((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100,
  )
  const brightnessFillStyle = { '--slider-fill': `${brightnessPercent}%` } as CSSProperties
  const colorTempKelvin = Math.round(1_000_000 / colorTemp)

  return (
    <div className="mt-4 space-y-5">
      {showToggle && (
        <div role="tablist" aria-label="Režim světla" className="flex gap-2">
          <ChipButton
            role="tab"
            aria-selected={tab === 'white'}
            selected={tab === 'white'}
            onClick={() => setTab('white')}
            className="min-h-12 px-4"
          >
            Bílá
          </ChipButton>
          <ChipButton
            role="tab"
            aria-selected={tab === 'color'}
            selected={tab === 'color'}
            onClick={() => setTab('color')}
            className="min-h-12 px-4"
          >
            Barva
          </ChipButton>
        </div>
      )}

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

      {(!showToggle || tab === 'white') && (
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
      )}

      {showToggle && tab === 'color' && (
        <div className="flex justify-center">
          <ColorWheel
            hue={hue}
            saturation={saturation}
            disabled={isDisabled}
            onChange={(h, s) => {
              draggingRef.current = true
              setHue(h)
              setSaturation(s)
            }}
            onCommit={commitColor}
          />
        </div>
      )}
    </div>
  )
}
