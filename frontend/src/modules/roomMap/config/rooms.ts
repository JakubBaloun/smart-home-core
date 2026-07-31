export interface RoomRect {
  /** All four values are percentages (0-100) of the floor plan container. */
  top: number
  left: number
  width: number
  height: number
}

export interface RoomConfig {
  id: string
  /** Not rendered on the map; used for aria-label/title only. */
  label: string
  /** device.friendlyName of the assigned sensor, or null if none yet. */
  sensorFriendlyName: string | null
  rect: RoomRect
}

export const rooms: RoomConfig[] = [
  {
    id: 'bedroom',
    label: 'Ložnice',
    sensorFriendlyName: null,
    rect: { top: 0, left: 0, width: 26.7, height: 100 },
  },
  {
    id: 'kitchen',
    label: 'Kuchyně',
    sensorFriendlyName: null,
    rect: { top: 0, left: 26.7, width: 20, height: 37.5 },
  },
  {
    id: 'wc',
    label: 'WC',
    sensorFriendlyName: null,
    rect: { top: 37.5, left: 26.7, width: 10, height: 37.5 },
  },
  {
    id: 'bathroom',
    label: 'Koupelna',
    sensorFriendlyName: null,
    rect: { top: 37.5, left: 36.7, width: 10, height: 37.5 },
  },
  {
    id: 'hallway',
    label: 'Chodba',
    sensorFriendlyName: null,
    rect: { top: 75, left: 26.7, width: 20, height: 25 },
  },
  {
    id: 'living-room',
    label: 'Obývák',
    sensorFriendlyName: null,
    rect: { top: 0, left: 46.7, width: 26.7, height: 100 },
  },
  {
    id: 'office',
    label: 'Pracovna',
    sensorFriendlyName: 'Bedroom temp',
    rect: { top: 0, left: 73.4, width: 26.6, height: 100 },
  },
]
