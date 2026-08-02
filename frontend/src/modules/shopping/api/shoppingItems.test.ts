import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createShoppingItem,
  deleteCheckedShoppingItems,
  deleteShoppingItem,
  getShoppingItems,
  updateShoppingItem,
} from './shoppingItems'
import type { ShoppingItemRequest } from '../types/shoppingItem'

describe('shopping items api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getShoppingItems requests the plain endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    await getShoppingItems()

    expect(fetch).toHaveBeenCalledWith('/api/shopping-items', expect.any(Object))
  })

  it('createShoppingItem posts the item payload', async () => {
    const request: ShoppingItemRequest = { name: 'Milk', quantity: '2L', checked: false, sortOrder: 0 }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await createShoppingItem(request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/shopping-items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    )
  })

  it('updateShoppingItem puts the item payload', async () => {
    const request: ShoppingItemRequest = { name: 'Milk', quantity: null, checked: true, sortOrder: 2 }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await updateShoppingItem(1, request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/shopping-items/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(request) }),
    )
  })

  it('deleteShoppingItem sends a DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteShoppingItem(1)

    expect(fetch).toHaveBeenCalledWith('/api/shopping-items/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteCheckedShoppingItems sends a DELETE request to the checked endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteCheckedShoppingItems()

    expect(fetch).toHaveBeenCalledWith(
      '/api/shopping-items/checked',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
