import { describe, expectTypeOf, it } from 'vitest'
import type { Device, DeviceCommandRequest } from './device'

describe('Device typings for color', () => {
  it('accepts hue/saturation/colorMode/supportsColor on Device', () => {
    const d: Device = {
      id: 1,
      ieeeAddress: '0x1',
      friendlyName: 'rgb',
      type: 'LIGHT',
      vendor: null,
      model: null,
      available: true,
      state: 'ON',
      brightness: 200,
      colorTemp: 320,
      hue: 200,
      saturation: 80,
      colorMode: 'hs',
      supportsColor: true,
      lastSeen: null,
      createdAt: '',
      updatedAt: '',
    }
    expectTypeOf(d.hue).toEqualTypeOf<number | null | undefined>()
    expectTypeOf(d.supportsColor).toEqualTypeOf<boolean | undefined>()
  })

  it("accepts 'setColor' as a DeviceCommandRequest command", () => {
    const req: DeviceCommandRequest = {
      command: 'setColor',
      payload: { hue: 200, saturation: 80 },
    }
    expectTypeOf(req.command).toEqualTypeOf<
      'setState' | 'setBrightness' | 'setColorTemp' | 'setColor' | 'raw'
    >()
  })
})
