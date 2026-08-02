"""Mapper functions between ShoppingItem and its Pydantic DTOs."""

from app.shopping.models import ShoppingItem
from app.shopping.schemas import ShoppingItemRequest, ShoppingItemResponse


def to_entity(request: ShoppingItemRequest) -> ShoppingItem:
    return ShoppingItem(
        name=request.name,
        quantity=request.quantity,
        checked=request.checked,
        sort_order=request.sortOrder,
    )


def to_response(item: ShoppingItem) -> ShoppingItemResponse:
    return ShoppingItemResponse(
        id=item.id,
        name=item.name,
        quantity=item.quantity,
        checked=item.checked,
        sortOrder=item.sort_order,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )
