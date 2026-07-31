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
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[]
}

export const rooms: RoomConfig[] = [
  {
    id: 'bedroom',
    label: 'Ložnice',
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 0, width: 26.7, height: 100 }],
  },
  {
    id: 'kitchen',
    label: 'Kuchyně',
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 26.7, width: 20, height: 37.5 }],
  },
  {
    id: 'wc',
    label: 'WC',
    sensorFriendlyName: null,
    rects: [{ top: 37.5, left: 26.7, width: 8, height: 37.5 }],
  },
  {
    id: 'bathroom',
    label: 'Koupelna',
    sensorFriendlyName: null,
    rects: [{ top: 37.5, left: 34.7, width: 8, height: 37.5 }],
  },
  {
    id: 'hallway',
    label: 'Chodba',
    sensorFriendlyName: null,
    // L-shaped: main strip at the bottom, plus a narrow connector up to the kitchen along Koupelna's right side.
    rects: [
      { top: 75, left: 26.7, width: 20, height: 25 },
      { top: 37.5, left: 42.7, width: 4, height: 37.5 },
    ],
  },
  {
    id: 'living-room',
    label: 'Obývák',
    sensorFriendlyName: null,
    rects: [{ top: 0, left: 46.7, width: 26.7, height: 100 }],
  },
  {
    id: 'office',
    label: 'Pracovna',
    sensorFriendlyName: 'Bedroom temp',
    rects: [{ top: 0, left: 73.4, width: 26.6, height: 100 }],
  },
]
