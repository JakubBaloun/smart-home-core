export interface ShoppingItem {
  id: number
  name: string
  quantity: string | null
  checked: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ShoppingItemRequest {
  name: string
  quantity: string | null
  checked: boolean
  sortOrder: number
}
