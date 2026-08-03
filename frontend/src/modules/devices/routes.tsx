import type { ModuleManifest } from '@/app/modules'
import { IconLayoutGrid } from '@/ui/icons'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { DevicesPage } from './pages/DevicesPage'

export const devicesModule: ModuleManifest = {
  nav: {
    to: '/devices',
    label: 'Devices',
    railLabel: 'Devices',
    icon: IconLayoutGrid,
    isActive: (pathname) => pathname.startsWith('/devices') || pathname.startsWith('/device/'),
  },
  routes: [
    { path: '/devices', element: <DevicesPage /> },
    { path: '/device/:id', element: <DeviceDetailPage /> },
  ],
}
