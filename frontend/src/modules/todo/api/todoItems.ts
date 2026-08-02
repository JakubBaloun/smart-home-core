import { apiFetch } from '@/api/client'
import type { TodoItem, TodoItemRequest } from '../types/todoItem'

export function getTodoItems(): Promise<TodoItem[]> {
  return apiFetch<TodoItem[]>('/todo-items')
}

export function createTodoItem(request: TodoItemRequest): Promise<TodoItem> {
  return apiFetch<TodoItem>('/todo-items', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateTodoItem(id: number, request: TodoItemRequest): Promise<TodoItem> {
  return apiFetch<TodoItem>(`/todo-items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

export function deleteTodoItem(id: number): Promise<void> {
  return apiFetch<void>(`/todo-items/${id}`, { method: 'DELETE' })
}

export function deleteDoneTodoItems(): Promise<void> {
  return apiFetch<void>('/todo-items/done', { method: 'DELETE' })
}
