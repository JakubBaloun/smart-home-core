import { afterEach, describe, expect, it } from 'vitest'
import type { ResponsiveLayouts } from 'react-grid-layout'
import { clearRoomLayout, loadRoomLayout, saveRoomLayout } from './roomLayoutStorage'

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
