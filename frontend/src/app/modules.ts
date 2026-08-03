import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { calendarModule } from '@/modules/calendar/routes'
import { devicesModule } from '@/modules/devices/routes'
import { homeModule } from '@/modules/home/routes'
import { recipesModule } from '@/modules/recipes/routes'
import { roomMapModule } from '@/modules/roomMap/routes'
import { shoppingModule } from '@/modules/shopping/routes'
import { temperatureModule } from '@/modules/temperature/routes'
import { todoModule } from '@/modules/todo/routes'

export interface ModuleNav {
  to: string
  label: string
  /** Short label rendered under the rail icon — the rail is only 80px wide, `label` can be too long. */
  railLabel: string
  icon: ComponentType<{ className?: string }>
  /** Which pathnames light this module up in the rail. */
  isActive: (pathname: string) => boolean
}

export interface ModuleManifest {
  nav: ModuleNav
  routes: RouteObject[]
}

/**
 * Feature modules rendered inside the shared shell, in rail order.
 * A new module ships a `routes.tsx` manifest and registers itself here.
 * Kiosk-style routes (no shell) are composed separately in App.tsx.
 */
export const shellModules: ModuleManifest[] = [
  homeModule,
  devicesModule,
  temperatureModule,
  roomMapModule,
  recipesModule,
  shoppingModule,
  todoModule,
  calendarModule,
]
