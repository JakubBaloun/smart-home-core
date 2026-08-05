import type { ResponsiveLayouts } from 'react-grid-layout'

const STORAGE_KEY = 'home-room-layout'
const TELEMETRY_STORAGE_KEY_PREFIX = 'room-telemetry-layout-'

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

export function loadRoomTelemetryLayout(roomId: string): ResponsiveLayouts | null {
  const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY_PREFIX + roomId)
  if (!raw) return null

  try {
    return JSON.parse(raw) as ResponsiveLayouts
  } catch {
    return null
  }
}

export function saveRoomTelemetryLayout(roomId: string, layouts: ResponsiveLayouts): void {
  localStorage.setItem(TELEMETRY_STORAGE_KEY_PREFIX + roomId, JSON.stringify(layouts))
}

export function clearRoomTelemetryLayout(roomId: string): void {
  localStorage.removeItem(TELEMETRY_STORAGE_KEY_PREFIX + roomId)
}
