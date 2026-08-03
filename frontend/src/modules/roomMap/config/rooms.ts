export type RoomEdge = 'top' | 'right' | 'bottom' | 'left'

export interface RoomRect {
  /** All four values are percentages (0-100) of the floor plan container. */
  top: number
  left: number
  width: number
  height: number
  /** Edges to render without a border, e.g. an open passage to a neighboring rect (no wall/door there). */
  openEdges?: RoomEdge[]
}

export interface RoomConfig {
  id: string
  /** Not rendered on the map; used for aria-label/title only. */
  label: string
  /** device.friendlyName values of assigned sensors (temperature, contact, ...), or [] if none yet. */
  sensorFriendlyNames: string[]
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[]
}

export const rooms: RoomConfig[] = [
  {
    id: 'bedroom',
    label: 'Ložnice',
    sensorFriendlyNames: [],
    rects: [{ top: 0, left: 0, width: 26.7, height: 100 }],
  },
  {
    id: 'kitchen',
    label: 'Kuchyně',
    sensorFriendlyNames: [],
    // Split so the sliver above the hallway connector can go without a bottom/left border — same
    // room on both sides of that internal seam, and the doorway down into the hallway is open.
    rects: [
      { top: 0, left: 26.7, width: 16, height: 37.5, openEdges: ['right'] },
      { top: 0, left: 42.7, width: 4, height: 37.5, openEdges: ['left', 'bottom'] },
    ],
  },
  {
    id: 'wc',
    label: 'WC',
    sensorFriendlyNames: [],
    rects: [{ top: 37.5, left: 26.7, width: 8, height: 37.5 }],
  },
  {
    id: 'bathroom',
    label: 'Koupelna',
    sensorFriendlyNames: [],
    rects: [{ top: 37.5, left: 34.7, width: 8, height: 37.5 }],
  },
  {
    id: 'hallway',
    label: 'Chodba',
    sensorFriendlyNames: [],
    // L-shaped: main strip split at the connector's width so that seam and the doorway up into the
    // kitchen can go without a border — no wall/door at either, it's one open room.
    rects: [
      { top: 75, left: 26.7, width: 16, height: 25, openEdges: ['right'] },
      { top: 75, left: 42.7, width: 4, height: 25, openEdges: ['left', 'top'] },
      { top: 37.5, left: 42.7, width: 4, height: 37.5, openEdges: ['top', 'bottom'] },
    ],
  },
  {
    id: 'living-room',
    label: 'Obývák',
    sensorFriendlyNames: [],
    rects: [{ top: 0, left: 46.7, width: 26.7, height: 100 }],
  },
  {
    id: 'office',
    label: 'Pracovna',
    sensorFriendlyNames: ['Bedroom temp', 'Dveře'],
    rects: [{ top: 0, left: 73.4, width: 26.6, height: 100 }],
  },
]
