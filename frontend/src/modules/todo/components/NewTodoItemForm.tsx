import { useState, type FormEvent } from 'react'
import { Button } from '@/ui/Button'
import { fieldClasses } from '@/ui/field'
import type { TodoItemRequest } from '../types/todoItem'

export function NewTodoItemForm({ onCreate }: { onCreate: (request: TodoItemRequest) => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({ title: title.trim(), dueDate: dueDate || null, done: false, sortOrder: 0 })
    setTitle('')
    setDueDate('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className={`min-w-0 flex-1 ${fieldClasses}`}
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className={fieldClasses}
      />
      <Button type="submit" variant="primary">
        Add
      </Button>
    </form>
  )
}
