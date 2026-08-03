import type { ModuleManifest } from '@/app/modules'
import { IconCalendar } from '@/ui/icons'
import { CalendarPage } from './pages/CalendarPage'

export const calendarModule: ModuleManifest = {
  nav: {
    to: '/calendar',
    label: 'Calendar',
    railLabel: 'Calendar',
    icon: IconCalendar,
    isActive: (pathname) => pathname.startsWith('/calendar'),
  },
  routes: [{ path: '/calendar', element: <CalendarPage /> }],
}
