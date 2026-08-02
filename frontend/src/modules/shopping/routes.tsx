import type { ModuleManifest } from '@/app/modules'
import { IconCart } from '@/ui/icons'
import { ShoppingListPage } from './pages/ShoppingListPage'

export const shoppingModule: ModuleManifest = {
  nav: {
    to: '/shopping',
    label: 'Shopping List',
    railLabel: 'Shopping',
    icon: IconCart,
    isActive: (pathname) => pathname.startsWith('/shopping'),
  },
  routes: [{ path: '/shopping', element: <ShoppingListPage /> }],
}
