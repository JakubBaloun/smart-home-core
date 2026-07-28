import type { MouseEvent } from 'react'
import { Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { RecipesPage } from './pages/RecipesPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeFormPage } from './pages/RecipeFormPage'
import { CookPickerPage } from './pages/cook/CookPickerPage'
import { CookRecipeDetailPage } from './pages/cook/CookRecipeDetailPage'
import { CookStepsPage } from './pages/cook/CookStepsPage'

function App() {
  const preventContextMenu = (e: MouseEvent) => e.preventDefault()

  return (
    <div className="h-screen w-screen bg-gray-950" onContextMenu={preventContextMenu}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/device/:id" element={<DeviceDetailPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/cook" element={<CookPickerPage />} />
        <Route path="/cook/:id" element={<CookRecipeDetailPage />} />
        <Route path="/cook/:id/steps" element={<CookStepsPage />} />
      </Routes>
    </div>
  )
}

export default App
