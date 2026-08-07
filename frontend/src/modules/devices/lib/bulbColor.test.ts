import { describe, expect, it } from 'vitest'
import { bulbColor } from './bulbColor'
import type { Device } from '../types/device'

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
    colorTemp: null,
    lastSeen: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('bulbColor', () => {
  it('returns null when the device is off', () => {
    expect(bulbColor(device({ state: 'OFF', colorTemp: 320 }))).toBeNull()
  })

  it('returns null when there is no color data at all', () => {
    expect(bulbColor(device({ state: 'ON', colorTemp: null }))).toBeNull()
  })

  it('returns an hsl() string in hs color mode', () => {
    expect(
      bulbColor(device({ colorMode: 'hs', hue: 210, saturation: 80, colorTemp: null })),
    ).toBe('hsl(210 80% 55%)')
  })

  it('ignores colorTemp when hs mode is active but hue/saturation are missing', () => {
    expect(bulbColor(device({ colorMode: 'hs', hue: null, saturation: null, colorTemp: 320 }))).not.toBeNull()
  })

  it('interpolates the cool stop at the minimum color temp (153)', () => {
    expect(bulbColor(device({ colorTemp: 153 }))).toBe('rgb(166 200 255)')
  })

  it('interpolates the middle stop exactly at 55% of the range', () => {
    // 153 + 0.55 * (500 - 153) = 343.85 -> lands exactly on the gradient's 55% stop
    expect(bulbColor(device({ colorTemp: 343.85 }))).toBe('rgb(255 233 199)')
  })

  it('interpolates a point partway through the first segment', () => {
    // 153 + 0.275 * (500 - 153) = 248.425 -> 27.5% of the range, halfway between
    // the 0% (166,200,255) and 55% (255,233,199) stops
    expect(bulbColor(device({ colorTemp: 248.425 }))).toBe('rgb(211 217 227)')
  })

  it('interpolates the warm stop at the maximum color temp (500)', () => {
    expect(bulbColor(device({ colorTemp: 500 }))).toBe('rgb(255 157 77)')
  })
})
