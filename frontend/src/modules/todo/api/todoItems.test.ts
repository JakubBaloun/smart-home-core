import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTodoItem,
  deleteDoneTodoItems,
  deleteTodoItem,
  getTodoItems,
  updateTodoItem,
} from './todoItems'
import type { TodoItemRequest } from '../types/todoItem'

describe('todo items api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getTodoItems requests the plain endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

    await getTodoItems()

    expect(fetch).toHaveBeenCalledWith('/api/todo-items', expect.any(Object))
  })

  it('createTodoItem posts the item payload', async () => {
    const request: TodoItemRequest = { title: 'Water plants', dueDate: '2026-08-05', done: false, sortOrder: 0 }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await createTodoItem(request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/todo-items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(request) }),
    )
  })

  it('updateTodoItem puts the item payload', async () => {
    const request: TodoItemRequest = { title: 'Water plants', dueDate: null, done: true, sortOrder: 1 }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 }))

    await updateTodoItem(1, request)

    expect(fetch).toHaveBeenCalledWith(
      '/api/todo-items/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(request) }),
    )
  })

  it('deleteTodoItem sends a DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteTodoItem(1)

    expect(fetch).toHaveBeenCalledWith('/api/todo-items/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteDoneTodoItems sends a DELETE request to the done endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await deleteDoneTodoItems()

    expect(fetch).toHaveBeenCalledWith('/api/todo-items/done', expect.objectContaining({ method: 'DELETE' }))
  })
})
