import type { ModuleManifest } from '@/app/modules'
import { IconHome } from '@/ui/icons'
import { RoomDetailPage } from './pages/RoomDetailPage'
import { RoomOverviewPage } from './pages/RoomOverviewPage'

export const homeModule: ModuleManifest = {
  nav: {
    to: '/',
    label: 'Home',
    railLabel: 'Home',
    icon: IconHome,
    isActive: (pathname) => pathname === '/' || pathname.startsWith('/room/'),
  },
  routes: [
    { path: '/', element: <RoomOverviewPage /> },
    { path: '/room/:id', element: <RoomDetailPage /> },
  ],
}
