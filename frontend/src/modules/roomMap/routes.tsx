import type { ModuleManifest } from '@/app/modules'
import { IconLayoutGrid } from '@/ui/icons'
import { RoomMapPage } from './pages/RoomMapPage'

export const roomMapModule: ModuleManifest = {
  nav: {
    to: '/room-map',
    label: 'Room Map',
    icon: IconLayoutGrid,
    isActive: (pathname) => pathname.startsWith('/room-map'),
  },
  routes: [{ path: '/room-map', element: <RoomMapPage /> }],
}
