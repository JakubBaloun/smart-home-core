import { Button } from '@/ui/Button'
import { IconCheck } from '@/ui/icons'
import type { TodoItem } from '../types/todoItem'

function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function TodoItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: TodoItem
  onToggle: (item: TodoItem) => void
  onDelete: (item: TodoItem) => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl transition hover:bg-overlay">
      <button
        type="button"
        aria-pressed={item.done}
        aria-label={item.title}
        onClick={() => onToggle(item)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 text-left"
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition ${
            item.done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
          }`}
        >
          {item.done && <IconCheck className="size-4" />}
        </span>
        <span className={`truncate ${item.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {item.title}
        </span>
        {item.dueDate && (
          <span
            className={`shrink-0 font-mono text-xs tabular-nums ${item.done ? 'text-ink-faint' : 'text-ink-muted'}`}
          >
            {formatDueDate(item.dueDate)}
          </span>
        )}
      </button>
      <Button
        size="md"
        variant="danger"
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.title}`}
        className="mr-1 shrink-0 px-3"
      >
        ✕
      </Button>
    </li>
  )
}
