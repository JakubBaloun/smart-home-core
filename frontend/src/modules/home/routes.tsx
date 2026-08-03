import type { ModuleManifest } from '@/app/modules'
import { IconHome } from '@/ui/icons'
import { RoomOverviewPage } from './pages/RoomOverviewPage'

export const homeModule: ModuleManifest = {
  nav: {
    to: '/',
    label: 'Home',
    railLabel: 'Home',
    icon: IconHome,
    isActive: (pathname) => pathname === '/',
  },
  routes: [{ path: '/', element: <RoomOverviewPage /> }],
}
