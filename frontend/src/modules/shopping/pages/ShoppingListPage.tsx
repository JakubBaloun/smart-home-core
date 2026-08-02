import { usePolling } from '@/hooks/usePolling'
import { Button } from '@/ui/Button'
import { Loading } from '@/ui/Loading'
import { PageHeader } from '@/ui/PageHeader'
import {
  createShoppingItem,
  deleteCheckedShoppingItems,
  deleteShoppingItem,
  getShoppingItems,
  updateShoppingItem,
} from '../api/shoppingItems'
import { NewShoppingItemForm } from '../components/NewShoppingItemForm'
import { ShoppingItemRow } from '../components/ShoppingItemRow'
import type { ShoppingItem, ShoppingItemRequest } from '../types/shoppingItem'

const REFRESH_INTERVAL_MS = 15_000

export function ShoppingListPage() {
  const { data: items, error, loading, refresh } = usePolling(getShoppingItems, REFRESH_INTERVAL_MS)

  const hasChecked = items?.some((item) => item.checked) ?? false

  const handleCreate = async (request: ShoppingItemRequest) => {
    await createShoppingItem(request)
    refresh()
  }

  const handleToggle = async (item: ShoppingItem) => {
    await updateShoppingItem(item.id, {
      name: item.name,
      quantity: item.quantity,
      checked: !item.checked,
      sortOrder: item.sortOrder,
    })
    refresh()
  }

  const handleDelete = async (item: ShoppingItem) => {
    await deleteShoppingItem(item.id)
    refresh()
  }

  const handleClearChecked = async () => {
    await deleteCheckedShoppingItems()
    refresh()
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 lg:px-8">
      <PageHeader
        title="Shopping List"
        actions={
          hasChecked ? (
            <Button variant="neutral" onClick={handleClearChecked}>
              Clear checked
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 max-w-md">
        <NewShoppingItemForm onCreate={handleCreate} />
      </div>

      {loading && !items && <Loading label="Fetching shopping list…" />}
      {error && <p className="text-danger">Failed to load shopping list: {error.message}</p>}
      {items && items.length === 0 && <p className="text-ink-muted">Nothing on the list.</p>}
      {items && items.length > 0 && (
        <ul className="max-w-md space-y-1">
          {items.map((item) => (
            <ShoppingItemRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
