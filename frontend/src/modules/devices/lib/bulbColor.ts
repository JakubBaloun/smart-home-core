import type { Device } from '../types/device'

// Mirrors LightControls.tsx's range for the white-mode color-temp slider.
const COLOR_TEMP_MIN = 153 // cool white (~6500K)
const COLOR_TEMP_MAX = 500 // warm white (~2000K)

// Same 3 stops as the `.light-slider-color-temp` gradient in index.css
// (#a6c8ff 0%, #ffe9c7 55%, #ff9d4d 100%), expressed as RGB triples so they
// can be linearly interpolated.
const GRADIENT_STOPS: Array<{ pct: number; rgb: [number, number, number] }> = [
  { pct: 0, rgb: [166, 200, 255] },
  { pct: 55, rgb: [255, 233, 199] },
  { pct: 100, rgb: [255, 157, 77] },
]

function interpolateGradient(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct))
  let lower = GRADIENT_STOPS[0]
  let upper = GRADIENT_STOPS[GRADIENT_STOPS.length - 1]
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (clamped >= GRADIENT_STOPS[i].pct && clamped <= GRADIENT_STOPS[i + 1].pct) {
      lower = GRADIENT_STOPS[i]
      upper = GRADIENT_STOPS[i + 1]
      break
    }
  }
  const span = upper.pct - lower.pct
  const t = span === 0 ? 0 : (clamped - lower.pct) / span
  const [r, g, b] = lower.rgb.map((c, i) => Math.round(c + (upper.rgb[i] - c) * t))
  return `rgb(${r} ${g} ${b})`
}

/**
 * Derives the CSS color a light is actually showing, or `null` when there's
 * no color information — either the light is off, or it reports neither an
 * `hs` color mode nor a color temperature. Callers fall back to the neutral
 * on/off treatment in that case rather than a hardcoded color.
 */
export function bulbColor(device: Device): string | null {
  if (device.state !== 'ON') return null

  if (device.colorMode === 'hs' && device.hue != null && device.saturation != null) {
    return `hsl(${device.hue} ${device.saturation}% 55%)`
  }

  if (device.colorTemp != null) {
    const pct = ((device.colorTemp - COLOR_TEMP_MIN) / (COLOR_TEMP_MAX - COLOR_TEMP_MIN)) * 100
    return interpolateGradient(pct)
  }

  return null
}
