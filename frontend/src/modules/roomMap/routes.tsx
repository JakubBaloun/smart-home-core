import type { ModuleManifest } from '@/app/modules'
import { IconMap } from '@/ui/icons'
import { RoomMapPage } from './pages/RoomMapPage'

export const roomMapModule: ModuleManifest = {
  nav: {
    to: '/room-map',
    label: 'Room Map',
    railLabel: 'Map',
    icon: IconMap,
    isActive: (pathname) => pathname.startsWith('/room-map'),
  },
  routes: [{ path: '/room-map', element: <RoomMapPage /> }],
}
