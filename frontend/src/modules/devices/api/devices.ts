import { apiFetch } from '@/api/client'
import type { Device, DeviceCommandRequest } from '../types/device'

export function getDevices(): Promise<Device[]> {
  return apiFetch<Device[]>('/devices')
}

export function getDevice(id: number): Promise<Device> {
  return apiFetch<Device>(`/devices/${id}`)
}

export function sendCommand(id: number, request: DeviceCommandRequest): Promise<void> {
  return apiFetch<void>(`/devices/${id}/command`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
