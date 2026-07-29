import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import { fieldClasses, labelClasses } from '@/ui/field'
import { createRecipe, getRecipe, updateRecipe } from '../api/recipes'
import { getTags } from '../api/tags'
import { IngredientListEditor } from '../components/IngredientListEditor'
import { StepListEditor } from '../components/StepListEditor'
import { TagPicker } from '../components/TagPicker'
import type { IngredientInput, RecipeRequest, StepInput } from '../types/recipe'

const REFRESH_INTERVAL_MS = 15_000

const EMPTY_REQUEST: RecipeRequest = {
  title: '',
  description: null,
  servingsBase: 4,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  notes: null,
  ingredients: [],
  steps: [],
  tags: [],
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined
  const recipeId = Number(id)
  const navigate = useNavigate()

  const { data: allTags } = usePolling(getTags, REFRESH_INTERVAL_MS)

  const [form, setForm] = useState<RecipeRequest>(EMPTY_REQUEST)
  const [loaded, setLoaded] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) return
    getRecipe(recipeId).then((recipe) => {
      setForm({
        title: recipe.title,
        description: recipe.description,
        servingsBase: recipe.servingsBase,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        notes: recipe.notes,
        ingredients: recipe.ingredients.map((i): IngredientInput => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        })),
        steps: recipe.steps.map((s): StepInput => ({
          title: s.title,
          content: s.content,
          timerSeconds: s.timerSeconds,
        })),
        tags: recipe.tags.map((t) => t.name),
      })
      setLoaded(true)
    })
  }, [isEdit, recipeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = isEdit ? await updateRecipe(recipeId, form) : await createRecipe(form)
      navigate(`/recipes/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <Loading />
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title={isEdit ? 'Edit Recipe' : 'New Recipe'}
        back={{ to: isEdit ? `/recipes/${recipeId}` : '/recipes', label: 'Cancel' }}
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 pb-8">
        <div>
          <label htmlFor="title" className={labelClasses}>
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={`w-full ${fieldClasses}`}
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClasses}>
            Description
          </label>
          <textarea
            id="description"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })}
            rows={2}
            className={`w-full ${fieldClasses}`}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="servingsBase" className={labelClasses}>
              Servings
            </label>
            <input
              id="servingsBase"
              type="number"
              min={1}
              value={form.servingsBase ?? ''}
              onChange={(e) =>
                setForm({ ...form, servingsBase: e.target.value ? Number(e.target.value) : null })
              }
              className={`w-full ${fieldClasses}`}
            />
          </div>
          <div>
            <label htmlFor="prepTimeMinutes" className={labelClasses}>
              Prep time (min)
            </label>
            <input
              id="prepTimeMinutes"
              type="number"
              min={0}
              value={form.prepTimeMinutes ?? ''}
              onChange={(e) =>
                setForm({ ...form, prepTimeMinutes: e.target.value ? Number(e.target.value) : null })
              }
              className={`w-full ${fieldClasses}`}
            />
          </div>
          <div>
            <label htmlFor="cookTimeMinutes" className={labelClasses}>
              Cook time (min)
            </label>
            <input
              id="cookTimeMinutes"
              type="number"
              min={0}
              value={form.cookTimeMinutes ?? ''}
              onChange={(e) =>
                setForm({ ...form, cookTimeMinutes: e.target.value ? Number(e.target.value) : null })
              }
              className={`w-full ${fieldClasses}`}
            />
          </div>
        </div>

        <div>
          <span className={labelClasses}>Tags</span>
          <TagPicker
            allTags={allTags ?? []}
            selected={form.tags}
            onChange={(tags) => setForm({ ...form, tags })}
          />
        </div>

        <div>
          <span className={labelClasses}>Ingredients</span>
          <IngredientListEditor
            value={form.ingredients}
            onChange={(ingredients) => setForm({ ...form, ingredients })}
          />
        </div>

        <div>
          <span className={labelClasses}>Steps</span>
          <StepListEditor value={form.steps} onChange={(steps) => setForm({ ...form, steps })} />
        </div>

        <div>
          <label htmlFor="notes" className={labelClasses}>
            Notes
          </label>
          <textarea
            id="notes"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            rows={2}
            className={`w-full ${fieldClasses}`}
          />
        </div>

        {error && <p className="text-danger">{error}</p>}

        <Button type="submit" variant="primary" disabled={saving}>
          {isEdit ? 'Save Changes' : 'Create Recipe'}
        </Button>
      </form>
    </div>
  )
}
