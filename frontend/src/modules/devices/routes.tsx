import type { ModuleManifest } from '@/app/modules'
import { IconHome } from '@/ui/icons'
import { DashboardPage } from './pages/DashboardPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'

export const devicesModule: ModuleManifest = {
  nav: {
    to: '/',
    label: 'Overview',
    railLabel: 'Home',
    icon: IconHome,
    isActive: (pathname) => pathname === '/' || pathname.startsWith('/device'),
  },
  routes: [
    { path: '/', element: <DashboardPage /> },
    { path: '/device/:id', element: <DeviceDetailPage /> },
  ],
}
