"""REST layer for /api/shopping-items."""

import logging

from fastapi import APIRouter, Response

from app.shopping.schemas import ShoppingItemRequest, ShoppingItemResponse
from app.shopping.service import shopping_item_service

log = logging.getLogger(__name__)

shopping_router = APIRouter(prefix="/api/shopping-items", tags=["shopping-items"])


@shopping_router.get("", response_model=list[ShoppingItemResponse])
def list_shopping_items() -> list[ShoppingItemResponse]:
    log.info("Request received to list shopping items")
    return shopping_item_service.list_items()


@shopping_router.post("", response_model=ShoppingItemResponse)
def create_shopping_item(request: ShoppingItemRequest) -> ShoppingItemResponse:
    log.info("Request received to create shopping item '%s'", request.name)
    return shopping_item_service.create_item(request)


# order matters: /checked must precede /{item_id}, else FastAPI tries to parse "checked" as int
@shopping_router.delete("/checked", status_code=204, response_class=Response)
def delete_checked_shopping_items() -> Response:
    log.info("Request received to delete all checked shopping items")
    shopping_item_service.delete_checked_items()
    return Response(status_code=204)


@shopping_router.put("/{item_id}", response_model=ShoppingItemResponse)
def update_shopping_item(item_id: int, request: ShoppingItemRequest) -> ShoppingItemResponse:
    log.info("Request received to update shopping item with id: %s", item_id)
    return shopping_item_service.update_item(item_id, request)


@shopping_router.delete("/{item_id}", status_code=204, response_class=Response)
def delete_shopping_item(item_id: int) -> Response:
    log.info("Request received to delete shopping item with id: %s", item_id)
    shopping_item_service.delete_item(item_id)
    return Response(status_code=204)
