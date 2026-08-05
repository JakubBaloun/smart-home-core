import { afterEach, describe, expect, it } from 'vitest'
import type { ResponsiveLayouts } from 'react-grid-layout'
import {
  clearRoomLayout,
  clearRoomTelemetryLayout,
  loadRoomLayout,
  loadRoomTelemetryLayout,
  saveRoomLayout,
  saveRoomTelemetryLayout,
} from './roomLayoutStorage'

describe('roomLayoutStorage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been saved', () => {
    expect(loadRoomLayout()).toBeNull()
  })

  it('round-trips a saved layout', () => {
    const layouts: ResponsiveLayouts = { lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] }

    saveRoomLayout(layouts)

    expect(loadRoomLayout()).toEqual(layouts)
  })

  it('returns null after the layout is cleared', () => {
    saveRoomLayout({ lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] })

    clearRoomLayout()

    expect(loadRoomLayout()).toBeNull()
  })

  it('returns null for corrupted stored JSON instead of throwing', () => {
    localStorage.setItem('home-room-layout', '{not-json')

    expect(loadRoomLayout()).toBeNull()
  })
})

describe('room-scoped telemetry layout', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing has been saved for a room', () => {
    expect(loadRoomTelemetryLayout('office')).toBeNull()
  })

  it('round-trips a saved layout, scoped by room id', () => {
    const layouts: ResponsiveLayouts = { lg: [{ i: '0xabc:temperature', x: 0, y: 0, w: 2, h: 2 }] }

    saveRoomTelemetryLayout('office', layouts)

    expect(loadRoomTelemetryLayout('office')).toEqual(layouts)
    expect(loadRoomTelemetryLayout('kitchen')).toBeNull()
  })

  it('returns null after the layout is cleared', () => {
    saveRoomTelemetryLayout('office', { lg: [{ i: '0xabc:temperature', x: 0, y: 0, w: 2, h: 2 }] })

    clearRoomTelemetryLayout('office')

    expect(loadRoomTelemetryLayout('office')).toBeNull()
  })

  it('returns null for corrupted stored JSON instead of throwing', () => {
    localStorage.setItem('room-telemetry-layout-office', '{not-json')

    expect(loadRoomTelemetryLayout('office')).toBeNull()
  })
})
