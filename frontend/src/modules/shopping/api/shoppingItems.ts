import { apiFetch } from '@/api/client'
import type { ShoppingItem, ShoppingItemRequest } from '../types/shoppingItem'

export function getShoppingItems(): Promise<ShoppingItem[]> {
  return apiFetch<ShoppingItem[]>('/shopping-items')
}

export function createShoppingItem(request: ShoppingItemRequest): Promise<ShoppingItem> {
  return apiFetch<ShoppingItem>('/shopping-items', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateShoppingItem(id: number, request: ShoppingItemRequest): Promise<ShoppingItem> {
  return apiFetch<ShoppingItem>(`/shopping-items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteShoppingItem(id: number): Promise<void> {
  return apiFetch<void>(`/shopping-items/${id}`, { method: 'DELETE' })
}

export function deleteCheckedShoppingItems(): Promise<void> {
  return apiFetch<void>('/shopping-items/checked', { method: 'DELETE' })
}
