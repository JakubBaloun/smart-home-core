export type DeviceType = 'LIGHT' | 'SENSOR' | 'SWITCH' | 'PLUG' | 'OTHER'

export interface Device {
  id: number
  ieeeAddress: string
  friendlyName: string
  type: DeviceType
  vendor: string | null
  model: string | null
  available: boolean
  lastSeen: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviceCommandRequest {
  command: 'setState' | 'setBrightness' | 'setColorTemp' | 'raw'
  payload: Record<string, unknown>
}
