import type { RouteObject } from 'react-router-dom'
import { CookPickerPage } from './pages/CookPickerPage'
import { CookRecipeDetailPage } from './pages/CookRecipeDetailPage'
import { CookStepsPage } from './pages/CookStepsPage'

/** Kiosk routes — rendered without the shared shell (no rail, full screen). */
export const cookRoutes: RouteObject[] = [
  { path: '/cook', element: <CookPickerPage /> },
  { path: '/cook/:id', element: <CookRecipeDetailPage /> },
  { path: '/cook/:id/steps', element: <CookStepsPage /> },
]
