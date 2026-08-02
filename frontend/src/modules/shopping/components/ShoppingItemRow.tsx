import { Button } from '@/ui/Button'
import { IconCheck } from '@/ui/icons'
import type { ShoppingItem } from '../types/shoppingItem'

export function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
  onDelete: (item: ShoppingItem) => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl transition hover:bg-overlay">
      <button
        type="button"
        aria-pressed={item.checked}
        aria-label={item.name}
        onClick={() => onToggle(item)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 text-left"
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition ${
            item.checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
          }`}
        >
          {item.checked && <IconCheck className="size-4" />}
        </span>
        <span className={`truncate ${item.checked ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {item.name}
        </span>
        {item.quantity && (
          <span
            className={`shrink-0 font-mono text-sm ${item.checked ? 'text-ink-faint' : 'text-ink-muted'}`}
          >
            {item.quantity}
          </span>
        )}
      </button>
      <Button
        size="md"
        variant="danger"
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.name}`}
        className="mr-1 shrink-0 px-3"
      >
        ✕
      </Button>
    </li>
  )
}
