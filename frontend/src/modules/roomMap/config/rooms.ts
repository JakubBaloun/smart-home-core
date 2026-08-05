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
  /** device.ieeeAddress values of every device assigned to this room — sensors, lights,
   *  switches, plugs, ... — or [] if none yet. Stable across friendlyName renames — unlike
   *  friendlyName, this never changes for a device. */
  deviceIeeeAddresses: string[]
  /** One rect per room, except non-rectangular rooms (e.g. an L-shaped hallway), which use several. */
  rects: RoomRect[]
}

export const rooms: RoomConfig[] = [
  {
    id: 'bedroom',
    label: 'Ložnice',
    deviceIeeeAddresses: [],
    rects: [{ top: 0, left: 0, width: 26.7, height: 100 }],
  },
  {
    id: 'kitchen',
    label: 'Kuchyně',
    deviceIeeeAddresses: [],
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
    deviceIeeeAddresses: [],
    rects: [{ top: 37.5, left: 26.7, width: 8, height: 37.5 }],
  },
  {
    id: 'bathroom',
    label: 'Koupelna',
    deviceIeeeAddresses: [],
    rects: [{ top: 37.5, left: 34.7, width: 8, height: 37.5 }],
  },
  {
    id: 'hallway',
    label: 'Chodba',
    deviceIeeeAddresses: [],
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
    deviceIeeeAddresses: [],
    rects: [{ top: 0, left: 46.7, width: 26.7, height: 100 }],
  },
  {
    id: 'office',
    label: 'Pracovna',
    deviceIeeeAddresses: ['0xe456acfffe5dc028', '0x54dce9fffefa56fb', '0xa4c138518ed616e3'],
    rects: [{ top: 0, left: 73.4, width: 26.6, height: 100 }],
  },
]
