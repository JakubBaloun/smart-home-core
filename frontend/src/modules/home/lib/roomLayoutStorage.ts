import type { ResponsiveLayouts } from 'react-grid-layout'

const STORAGE_KEY = 'home-room-layout'

export function loadRoomLayout(): ResponsiveLayouts | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as ResponsiveLayouts
  } catch {
    return null
  }
}

export function saveRoomLayout(layouts: ResponsiveLayouts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
}

export function clearRoomLayout(): void {
  localStorage.removeItem(STORAGE_KEY)
}
