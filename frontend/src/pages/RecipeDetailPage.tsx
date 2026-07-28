import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteRecipe, getRecipe } from '../api/recipes'
import { ServingsToggle } from '../components/ServingsToggle'
import { usePolling } from '../hooks/usePolling'
import { formatAmount, scaleAmount } from '../lib/portionScaling'

const REFRESH_INTERVAL_MS = 15_000

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const [servings, setServings] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: recipe, error } = usePolling(() => getRecipe(recipeId), REFRESH_INTERVAL_MS, [recipeId])

  if (error) {
    return <p className="p-6 text-red-400">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <p className="p-6 text-gray-500">Loading...</p>
  }

  const targetServings = servings ?? recipe.servingsBase

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteRecipe(recipe.id)
      navigate('/recipes')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <Link to="/recipes" className="text-sm text-gray-500 hover:text-gray-300">
        ← Back to recipes
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-100">{recipe.title}</h1>
        <div className="flex gap-3">
          <Link
            to={`/cook/${recipe.id}`}
            className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-600"
          >
            Cook this
          </Link>
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 transition hover:bg-gray-700"
          >
            Edit
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-red-400 transition hover:bg-gray-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {recipe.description && <p className="mt-2 text-gray-400">{recipe.description}</p>}

      <p className="mt-2 text-sm text-gray-500">
        {recipe.prepTimeMinutes != null && `Prep ${recipe.prepTimeMinutes}m`}
        {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && ' · '}
        {recipe.cookTimeMinutes != null && `Cook ${recipe.cookTimeMinutes}m`}
      </p>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ServingsToggle value={targetServings} onChange={setServings} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-medium text-gray-100">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="text-gray-300">
                {formatAmount(scaleAmount(ingredient.amount, recipe.servingsBase, targetServings))}
                {ingredient.unit ? ` ${ingredient.unit.toLowerCase()}` : ''} {ingredient.name}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-medium text-gray-100">Steps</h2>
          <ol className="space-y-3">
            {recipe.steps.map((step) => (
              <li key={step.id} className="text-gray-300">
                <span className="font-medium text-gray-100">{step.stepNumber}. {step.title}</span>
                <p className="text-gray-400">{step.content}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.notes && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-medium text-gray-100">Notes</h2>
          <p className="text-gray-400">{recipe.notes}</p>
        </div>
      )}
    </div>
  )
}
