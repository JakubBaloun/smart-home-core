import type { ModuleManifest } from '@/app/modules'
import { IconChecklist } from '@/ui/icons'
import { TodoListPage } from './pages/TodoListPage'

export const todoModule: ModuleManifest = {
  nav: {
    to: '/todo',
    label: 'To-Do List',
    railLabel: 'To-Do',
    icon: IconChecklist,
    isActive: (pathname) => pathname.startsWith('/todo'),
  },
  routes: [{ path: '/todo', element: <TodoListPage /> }],
}
