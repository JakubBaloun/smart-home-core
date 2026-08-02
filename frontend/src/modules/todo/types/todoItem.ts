export interface TodoItem {
  id: number
  title: string
  dueDate: string | null
  done: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TodoItemRequest {
  title: string
  dueDate: string | null
  done: boolean
  sortOrder: number
}
