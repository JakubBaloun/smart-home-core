export interface RoomConfig {
  id: string
  label: string
  /** device.friendlyName of the assigned sensor, or null if none yet. */
  sensorFriendlyName: string | null
  /** CSS grid-area name used by the floor plan layout. */
  area: string
}

export const rooms: RoomConfig[] = [
  { id: 'living-room', label: 'Obývák', sensorFriendlyName: null, area: 'living' },
  { id: 'kitchen', label: 'Kuchyně', sensorFriendlyName: null, area: 'kitchen' },
  { id: 'bedroom', label: 'Ložnice', sensorFriendlyName: 'Bedroom temp', area: 'bedroom' },
  { id: 'kids-room', label: 'Dětský pokoj', sensorFriendlyName: null, area: 'kids' },
  { id: 'bathroom', label: 'Koupelna', sensorFriendlyName: null, area: 'bathroom' },
  { id: 'hallway', label: 'Chodba', sensorFriendlyName: null, area: 'hallway' }
]
