import type { ModuleManifest } from '@/app/modules'
import { IconPot } from '@/ui/icons'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeFormPage } from './pages/RecipeFormPage'
import { RecipesPage } from './pages/RecipesPage'

export const recipesModule: ModuleManifest = {
  nav: {
    to: '/recipes',
    label: 'Recipes',
    icon: IconPot,
    isActive: (pathname) => pathname.startsWith('/recipes'),
  },
  routes: [
    { path: '/recipes', element: <RecipesPage /> },
    { path: '/recipes/new', element: <RecipeFormPage /> },
    { path: '/recipes/:id', element: <RecipeDetailPage /> },
    { path: '/recipes/:id/edit', element: <RecipeFormPage /> },
  ],
}
