"""Business logic for the shopping list."""

import logging
from datetime import datetime, timezone

from app.common.exceptions import ResourceNotFoundError
from app.db import read_session, transaction
from app.shopping import mappers
from app.shopping.repository import shopping_item_repository
from app.shopping.schemas import ShoppingItemRequest, ShoppingItemResponse

log = logging.getLogger(__name__)


class ShoppingItemService:
    def list_items(self) -> list[ShoppingItemResponse]:
        with read_session() as session:
            items = shopping_item_repository.list_all(session)
            log.debug("Retrieved %d shopping item(s)", len(items))
            return [mappers.to_response(i) for i in items]

    def create_item(self, request: ShoppingItemRequest) -> ShoppingItemResponse:
        log.info("Creating shopping item '%s'", request.name)
        with transaction() as session:
            item = mappers.to_entity(request)
            shopping_item_repository.save(item, session)
            log.info("Shopping item '%s' created with id %s", item.name, item.id)
            return mappers.to_response(item)

    def update_item(self, item_id: int, request: ShoppingItemRequest) -> ShoppingItemResponse:
        log.info("Updating shopping item with id %s", item_id)
        with transaction() as session:
            item = shopping_item_repository.find_by_id(item_id, session)
            if item is None:
                raise ResourceNotFoundError("ShoppingItem", item_id)
            item.name = request.name
            item.quantity = request.quantity
            item.checked = request.checked
            item.sort_order = request.sortOrder
            item.updated_at = datetime.now(timezone.utc)
            shopping_item_repository.save(item, session)
            return mappers.to_response(item)

    def delete_item(self, item_id: int) -> None:
        log.info("Deleting shopping item with id %s", item_id)
        with transaction() as session:
            item = shopping_item_repository.find_by_id(item_id, session)
            if item is None:
                raise ResourceNotFoundError("ShoppingItem", item_id)
            shopping_item_repository.delete(item, session)

    def delete_checked_items(self) -> int:
        log.info("Deleting all checked shopping items")
        with transaction() as session:
            count = shopping_item_repository.delete_checked(session)
            log.info("Deleted %d checked shopping item(s)", count)
            return count


shopping_item_service = ShoppingItemService()
