export type DeviceType = 'LIGHT' | 'SENSOR' | 'SWITCH' | 'PLUG' | 'OTHER'

export interface Device {
  id: number
  ieeeAddress: string
  friendlyName: string
  type: DeviceType
  vendor: string | null
  model: string | null
  available: boolean
  state: 'ON' | 'OFF' | null
  brightness: number | null
  colorTemp: number | null
  hue?: number | null
  saturation?: number | null
  colorMode?: string | null
  supportsColor?: boolean
  lastSeen: string | null
  createdAt: string
  updatedAt: string
}

export interface DeviceCommandRequest {
  command: 'setState' | 'setBrightness' | 'setColorTemp' | 'setColor' | 'raw'
  payload: Record<string, unknown>
}

export interface UpdateDeviceRequest {
  friendlyName: string
  type: DeviceType
}
