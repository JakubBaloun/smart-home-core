import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRecipe } from '../../api/recipes'
import { ServingsToggle } from '../../components/ServingsToggle'
import { usePolling } from '../../hooks/usePolling'
import { formatAmount, scaleAmount } from '../../lib/portionScaling'

const REFRESH_INTERVAL_MS = 15_000

export function CookRecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const [servings, setServings] = useState<number | null>(null)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  if (error) {
    return <p className="p-8 text-xl text-red-400">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <p className="p-8 text-xl text-gray-500">Loading...</p>
  }

  const targetServings = servings ?? recipe.servingsBase

  return (
    <div className="h-full overflow-y-auto p-8">
      <Link to="/cook" className="text-lg text-gray-500 hover:text-gray-300">
        ← Recipe list
      </Link>

      <h1 className="mt-4 text-3xl font-semibold text-gray-100">{recipe.title}</h1>

      <div className="mt-6">
        <ServingsToggle value={targetServings} onChange={setServings} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-2xl font-medium text-gray-100">Ingredients</h2>
        <ul className="space-y-2 text-xl">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="text-gray-300">
              {formatAmount(scaleAmount(ingredient.amount, recipe.servingsBase, targetServings))}
              {ingredient.unit ? ` ${ingredient.unit.toLowerCase()}` : ''} {ingredient.name}
            </li>
          ))}
        </ul>
      </div>

      <Link
        to={`/cook/${recipe.id}/steps`}
        className="mt-10 inline-block rounded-xl bg-emerald-700 px-8 py-4 text-xl font-medium text-white transition hover:bg-emerald-600"
      >
        Start Cooking
      </Link>
    </div>
  )
}
