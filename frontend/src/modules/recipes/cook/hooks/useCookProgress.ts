import { useCallback, useRef, useState } from 'react'

export interface CookProgress {
  stepIndex: number
  servings: number | null
  checkedIngredientIds: number[]
}

interface StoredProgress extends CookProgress {
  updatedAt: number
}

const STORAGE_PREFIX = 'nexus-cook-progress:'

/** A cook session that has been idle this long is over — resuming it would be confusing. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000

const EMPTY: CookProgress = { stepIndex: 0, servings: null, checkedIngredientIds: [] }

function storageKey(recipeId: number): string {
  return `${STORAGE_PREFIX}${recipeId}`
}

function sanitize(stored: Partial<StoredProgress>): CookProgress {
  return {
    stepIndex: Number.isInteger(stored.stepIndex) && stored.stepIndex! > 0 ? stored.stepIndex! : 0,
    servings: typeof stored.servings === 'number' && stored.servings > 0 ? stored.servings : null,
    checkedIngredientIds: Array.isArray(stored.checkedIngredientIds)
      ? stored.checkedIngredientIds.filter((id) => typeof id === 'number')
      : [],
  }
}

function read(recipeId: number): CookProgress {
  try {
    const raw = localStorage.getItem(storageKey(recipeId))
    if (!raw) return EMPTY

    const stored = JSON.parse(raw) as Partial<StoredProgress>
    if (typeof stored?.updatedAt !== 'number' || Date.now() - stored.updatedAt > MAX_AGE_MS) {
      return EMPTY
    }
    return sanitize(stored)
  } catch {
    return EMPTY
  }
}

function write(recipeId: number, progress: CookProgress): void {
  try {
    const stored: StoredProgress = { ...progress, updatedAt: Date.now() }
    localStorage.setItem(storageKey(recipeId), JSON.stringify(stored))
  } catch {
    // Storage can be unavailable or full; losing the progress is acceptable.
  }
}

function clear(recipeId: number): void {
  try {
    localStorage.removeItem(storageKey(recipeId))
  } catch {
    // See write().
  }
}

/**
 * Cooking progress that survives a reload or a mistimed tap out of the flow.
 *
 * Every change is persisted synchronously: a page hands over to the next one by
 * navigating in the same commit as the update, so an effect would run too late.
 *
 * `resumeStepIndex` is the step found in storage when the recipe was opened, so the
 * prep screen can offer to resume without being moved by later navigation.
 */
export function useCookProgress(recipeId: number) {
  const [progress, setProgress] = useState(() => read(recipeId))
  const [loadedFor, setLoadedFor] = useState(recipeId)
  const resumeStepIndexRef = useRef(progress.stepIndex)
  const progressRef = useRef(progress)

  if (!Object.is(loadedFor, recipeId)) {
    const loaded = read(recipeId)
    resumeStepIndexRef.current = loaded.stepIndex
    progressRef.current = loaded
    setLoadedFor(recipeId)
    setProgress(loaded)
  }

  const apply = useCallback(
    (next: CookProgress) => {
      progressRef.current = next
      write(recipeId, next)
      setProgress(next)
    },
    [recipeId],
  )

  const setStepIndex = useCallback(
    (stepIndex: number) => apply({ ...progressRef.current, stepIndex: Math.max(0, stepIndex) }),
    [apply],
  )

  const setServings = useCallback(
    (servings: number) => apply({ ...progressRef.current, servings }),
    [apply],
  )

  const toggleIngredient = useCallback(
    (ingredientId: number) => {
      const { checkedIngredientIds } = progressRef.current
      apply({
        ...progressRef.current,
        checkedIngredientIds: checkedIngredientIds.includes(ingredientId)
          ? checkedIngredientIds.filter((id) => id !== ingredientId)
          : [...checkedIngredientIds, ingredientId],
      })
    },
    [apply],
  )

  const reset = useCallback(() => {
    clear(recipeId)
    resumeStepIndexRef.current = 0
    progressRef.current = EMPTY
    setProgress(EMPTY)
  }, [recipeId])

  return {
    ...progress,
    resumeStepIndex: resumeStepIndexRef.current,
    setStepIndex,
    setServings,
    toggleIngredient,
    reset,
  }
}
