import { apiFetch } from '@/api/client'
import type { Device, DeviceCommandRequest, UpdateDeviceRequest } from '../types/device'

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

export function updateDevice(id: number, request: UpdateDeviceRequest): Promise<void> {
  return apiFetch<void>(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteDevice(id: number): Promise<void> {
  return apiFetch<void>(`/devices/${id}`, { method: 'DELETE' })
}
