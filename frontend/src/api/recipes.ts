import { apiFetch } from './client'
import type { PageResponse, Recipe, RecipeDetail, RecipeRequest } from '../types/recipe'

export interface RecipeSearchParams {
  search?: string
  tags?: string[]
  page?: number
  size?: number
}

export function getRecipes(params: RecipeSearchParams = {}): Promise<PageResponse<Recipe>> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  for (const tag of params.tags ?? []) query.append('tag', tag)
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.size !== undefined) query.set('size', String(params.size))
  const qs = query.toString()
  return apiFetch<PageResponse<Recipe>>(`/recipes${qs ? `?${qs}` : ''}`)
}

export function getRecipe(id: number): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${id}`)
}

export function createRecipe(request: RecipeRequest): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>('/recipes', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateRecipe(id: number, request: RecipeRequest): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteRecipe(id: number): Promise<void> {
  return apiFetch<void>(`/recipes/${id}`, { method: 'DELETE' })
}
