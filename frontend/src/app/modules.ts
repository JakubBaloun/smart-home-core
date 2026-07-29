import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { devicesModule } from '@/modules/devices/routes'
import { recipesModule } from '@/modules/recipes/routes'

export interface ModuleNav {
  to: string
  label: string
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
export const shellModules: ModuleManifest[] = [devicesModule, recipesModule]
