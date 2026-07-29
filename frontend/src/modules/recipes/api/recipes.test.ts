import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecipe, deleteRecipe, getRecipe, getRecipes, updateRecipe } from './recipes'
import type { RecipeRequest } from '../types/recipe'

describe('recipes api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getRecipes with no params requests the plain endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }), {
        status: 200,
      }),
    )

    await getRecipes()

    expect(fetch).toHaveBeenCalledWith('/api/recipes', expect.any(Object))
  })

  it('getRecipes repeats the tag param per value and includes search/page/size', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 }), {
        status: 200,
      }),
    )

    await getRecipes({ search: 'soup', tags: ['quick', 'vegan'], page: 1, size: 10 })

    expect(fetch).toHaveBeenCalledWith(
      '/api/recipes?search=soup&tag=quick&tag=vegan&page=1&size=10',
      expect.any(Object),
    )
  })

  it('getRecipe fetches a single recipe by id', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 5 }), { status: 200 }))

    await getRecipe(5)

    expect(fetch).toHaveBeenCalledWith('/api/recipes/5', expect.any(Object))
  })

  it('createRecipe posts the recipe payload', async () => {
    const request: RecipeRequest = {
      title: 'Soup',
      description: null,
      servingsBase: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      notes: null,
      ingredients: [{ name: 'Tomato', amount: 2, unit: null }],
      steps: [{ title: null, content: 'Boil it', timerSeconds: null }],
      tags: [],
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await createRecipe(request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/recipes',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    )
  })

  it('updateRecipe puts the recipe payload', async () => {
    const request: RecipeRequest = {
      title: 'Soup',
      description: null,
      servingsBase: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      notes: null,
      ingredients: [],
      steps: [],
      tags: [],
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await updateRecipe(1, request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/recipes/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(request) }),
    )
  })

  it('deleteRecipe sends a DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteRecipe(1)

    expect(fetch).toHaveBeenCalledWith('/api/recipes/1', expect.objectContaining({ method: 'DELETE' }))
  })
})
