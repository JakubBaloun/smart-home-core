import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import {
  createTodoItem,
  deleteDoneTodoItems,
  deleteTodoItem,
  getTodoItems,
  updateTodoItem,
} from '../api/todoItems'
import { NewTodoItemForm } from '../components/NewTodoItemForm'
import { TodoItemRow } from '../components/TodoItemRow'
import type { TodoItem, TodoItemRequest } from '../types/todoItem'

const REFRESH_INTERVAL_MS = 15_000

export function TodoListPage() {
  const { data: items, error, loading, refresh } = usePolling(getTodoItems, REFRESH_INTERVAL_MS)

  const hasDone = items?.some((item) => item.done) ?? false

  const handleCreate = async (request: TodoItemRequest) => {
    await createTodoItem(request)
    refresh()
  }

  const handleToggle = async (item: TodoItem) => {
    await updateTodoItem(item.id, {
      title: item.title,
      dueDate: item.dueDate,
      done: !item.done,
      sortOrder: item.sortOrder,
    })
    refresh()
  }

  const handleDelete = async (item: TodoItem) => {
    await deleteTodoItem(item.id)
    refresh()
  }

  const handleClearDone = async () => {
    await deleteDoneTodoItems()
    refresh()
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title="To-Do List"
        actions={
          hasDone ? (
            <Button variant="neutral" onClick={handleClearDone}>
              Clear done
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 max-w-md">
        <NewTodoItemForm onCreate={handleCreate} />
      </div>

      {loading && !items && <Loading label="Fetching to-do list…" />}
      {error && <p className="text-danger">Failed to load to-do list: {error.message}</p>}
      {items && items.length === 0 && <p className="text-ink-muted">Nothing to do.</p>}
      {items && items.length > 0 && (
        <ul className="max-w-md space-y-1">
          {items.map((item) => (
            <TodoItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
