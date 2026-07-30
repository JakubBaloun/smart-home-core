import type { ModuleManifest } from '@/app/modules'
import { IconThermometer } from '@/ui/icons'
import { TemperaturePage } from './pages/TemperaturePage'

export const temperatureModule: ModuleManifest = {
  nav: {
    to: '/temperature',
    label: 'Temperature',
    icon: IconThermometer,
    isActive: (pathname) => pathname.startsWith('/temperature'),
  },
  routes: [{ path: '/temperature', element: <TemperaturePage /> }],
}
