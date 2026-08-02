import { useState, type FormEvent } from 'react'
import { Button } from '@/ui/Button'
import { fieldClasses } from '@/ui/field'
import type { ShoppingItemRequest } from '../types/shoppingItem'

export function NewShoppingItemForm({
  onCreate,
}: {
  onCreate: (request: ShoppingItemRequest) => void
}) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name: name.trim(), quantity: quantity.trim() || null, checked: false, sortOrder: 0 })
    setName('')
    setQuantity('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className={`min-w-0 flex-1 ${fieldClasses}`}
      />
      <input
        type="text"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Quantity"
        className={`w-32 ${fieldClasses}`}
      />
      <Button type="submit" variant="primary">
        Add
      </Button>
    </form>
  )
}
