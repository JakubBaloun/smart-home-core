import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCookProgress } from './useCookProgress'

const RECIPE_ID = 7
const STORAGE_KEY = `nexus-cook-progress:${RECIPE_ID}`

describe('useCookProgress', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts at the first step with no ingredients checked', () => {
    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    expect(result.current.stepIndex).toBe(0)
    expect(result.current.servings).toBeNull()
    expect(result.current.checkedIngredientIds).toEqual([])
  })

  it('restores the step, servings and checked ingredients after a reload', () => {
    const { result, unmount } = renderHook(() => useCookProgress(RECIPE_ID))

    act(() => {
      result.current.setStepIndex(3)
      result.current.setServings(6)
      result.current.toggleIngredient(42)
    })
    unmount()

    const reloaded = renderHook(() => useCookProgress(RECIPE_ID))

    expect(reloaded.result.current.stepIndex).toBe(3)
    expect(reloaded.result.current.servings).toBe(6)
    expect(reloaded.result.current.checkedIngredientIds).toEqual([42])
  })

  it('keeps resumeStepIndex at the stored step while navigating', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stepIndex: 4, servings: null, checkedIngredientIds: [], updatedAt: Date.now() }),
    )

    const { result } = renderHook(() => useCookProgress(RECIPE_ID))
    expect(result.current.resumeStepIndex).toBe(4)

    act(() => result.current.setStepIndex(1))

    expect(result.current.stepIndex).toBe(1)
    expect(result.current.resumeStepIndex).toBe(4)
  })

  it('toggles an ingredient off again', () => {
    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    act(() => result.current.toggleIngredient(1))
    act(() => result.current.toggleIngredient(1))

    expect(result.current.checkedIngredientIds).toEqual([])
  })

  it('discards progress from a session that is long over', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stepIndex: 5,
        servings: 8,
        checkedIngredientIds: [1],
        updatedAt: Date.now() - 13 * 60 * 60 * 1000,
      }),
    )

    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    expect(result.current.stepIndex).toBe(0)
    expect(result.current.resumeStepIndex).toBe(0)
  })

  it('keeps progress separate per recipe', () => {
    const { result } = renderHook(() => useCookProgress(RECIPE_ID))
    act(() => result.current.setStepIndex(2))

    const other = renderHook(() => useCookProgress(RECIPE_ID + 1))

    expect(other.result.current.stepIndex).toBe(0)
  })

  it('persists before the caller can navigate away', () => {
    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    act(() => {
      result.current.setStepIndex(2)
      // Still inside the same commit: the next page reads storage before effects run.
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).stepIndex).toBe(2)
    })
  })

  it('ignores a corrupt entry', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')

    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    expect(result.current.stepIndex).toBe(0)
  })

  it('ignores stored values of the wrong shape', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stepIndex: -3,
        servings: 'four',
        checkedIngredientIds: 'all',
        updatedAt: Date.now(),
      }),
    )

    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    expect(result.current.stepIndex).toBe(0)
    expect(result.current.servings).toBeNull()
    expect(result.current.checkedIngredientIds).toEqual([])
  })

  it('tolerates an unparsable recipe id in the route', () => {
    const { result } = renderHook(() => useCookProgress(Number('kolache')))

    expect(result.current.stepIndex).toBe(0)
  })

  it('clears everything on reset', () => {
    const { result } = renderHook(() => useCookProgress(RECIPE_ID))

    act(() => {
      result.current.setStepIndex(3)
      result.current.toggleIngredient(9)
    })
    act(() => result.current.reset())

    expect(result.current.stepIndex).toBe(0)
    expect(result.current.checkedIngredientIds).toEqual([])
    expect(result.current.resumeStepIndex).toBe(0)
  })
})
