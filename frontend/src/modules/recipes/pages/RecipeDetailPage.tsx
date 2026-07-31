import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button, ButtonLink } from '@/ui/Button'
import { Chip } from '@/ui/Chip'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { IconClock, IconServing } from '@/ui/icons'
import { deleteRecipe, getRecipe } from '../api/recipes'
import { ServingsToggle } from '../components/ServingsToggle'
import { formatAmount, scaleAmount } from '../lib/portionScaling'
import { formatTotalTime, formatUnit } from '../lib/units'

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
  const totalTime = formatTotalTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)

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

      {recipe.description && <p className="max-w-2xl text-ink-muted">{recipe.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-ink-muted tabular-nums">
        {totalTime && (
          <span className="inline-flex items-center gap-1.5">
            <IconClock className="size-4 text-ink-faint" />
            {totalTime}
            {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && (
              <span className="text-ink-faint">
                ({recipe.prepTimeMinutes} prep + {recipe.cookTimeMinutes} cook)
              </span>
            )}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <IconServing className="size-4 text-ink-faint" />
          serves {recipe.servingsBase}
        </span>
      </div>

      {recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 pb-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface-raised p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">Ingredients</h2>
          <ServingsToggle value={targetServings} onChange={setServings} />
          <ul className="mt-4 space-y-2">
            {recipe.ingredients.map((ingredient) => {
              const unit = formatUnit(ingredient.unit)
              return (
                <li key={ingredient.id} className="flex gap-3 text-ink">
                  <span className="w-24 shrink-0 text-right font-mono text-accent tabular-nums">
                    {formatAmount(scaleAmount(ingredient.amount, recipe.servingsBase, targetServings))}
                    {unit && <span className="text-ink-muted"> {unit}</span>}
                  </span>
                  {ingredient.name}
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">Steps</h2>
          <ol className="space-y-3">
            {recipe.steps.map((step) => (
              <li
                key={step.id}
                className="flex gap-4 rounded-2xl border border-line bg-surface-raised p-4"
              >
                <span className="font-mono text-lg text-ink-faint tabular-nums">
                  {step.stepNumber}
                </span>
                <div className="min-w-0">
                  {step.title && <p className="font-display font-medium text-ink">{step.title}</p>}
                  <p className="whitespace-pre-line text-ink-muted">{step.content}</p>
                </div>
              </li>
            ))}
          </ol>

          {recipe.notes && (
            <div className="mt-6 rounded-2xl border border-line bg-surface-sunken p-4">
              <h3 className="mb-1 font-mono text-xs tracking-widest text-ink-faint uppercase">Notes</h3>
              <p className="whitespace-pre-line text-ink-muted">{recipe.notes}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
