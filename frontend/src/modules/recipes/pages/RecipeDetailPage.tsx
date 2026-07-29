import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button, ButtonLink } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { deleteRecipe, getRecipe } from '../api/recipes'
import { ServingsToggle } from '../components/ServingsToggle'
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
    return <p className="p-6 text-danger">Failed to load recipe: {error.message}</p>
  }

  if (!recipe) {
    return <Loading />
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
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title={recipe.title}
        back={{ to: '/recipes', label: 'Recipes' }}
        actions={
          <>
            <ButtonLink to={`/cook/${recipe.id}`} variant="primary">
              Cook this
            </ButtonLink>
            <ButtonLink to={`/recipes/${recipe.id}/edit`} variant="neutral">
              Edit
            </ButtonLink>
            <Button variant="danger" disabled={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      />

      {recipe.description && <p className="text-ink-muted">{recipe.description}</p>}

      <p className="mt-2 font-mono text-sm text-ink-faint">
        {recipe.prepTimeMinutes != null && `Prep ${recipe.prepTimeMinutes}m`}
        {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && ' · '}
        {recipe.cookTimeMinutes != null && `Cook ${recipe.cookTimeMinutes}m`}
      </p>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ServingsToggle value={targetServings} onChange={setServings} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id} className="text-ink">
                <span className="font-mono tabular-nums">
                  {formatAmount(scaleAmount(ingredient.amount, recipe.servingsBase, targetServings))}
                  {ingredient.unit ? ` ${ingredient.unit.toLowerCase()}` : ''}
                </span>{' '}
                {ingredient.name}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Steps</h2>
          <ol className="space-y-3">
            {recipe.steps.map((step) => (
              <li key={step.id} className="text-ink">
                <span className="font-medium">
                  {step.stepNumber}. {step.title}
                </span>
                <p className="text-ink-muted">{step.content}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.notes && (
        <div className="mt-8">
          <h2 className="mb-2 font-display text-xl font-semibold text-ink">Notes</h2>
          <p className="text-ink-muted">{recipe.notes}</p>
        </div>
      )}
    </div>
  )
}
