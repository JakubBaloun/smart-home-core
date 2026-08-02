"""Business logic for the todo list."""

import logging
from datetime import datetime, timezone

from app.common.exceptions import ResourceNotFoundError
from app.db import read_session, transaction
from app.todo import mappers
from app.todo.repository import todo_item_repository
from app.todo.schemas import TodoItemRequest, TodoItemResponse

log = logging.getLogger(__name__)


class TodoItemService:
    def list_items(self) -> list[TodoItemResponse]:
        with read_session() as session:
            items = todo_item_repository.list_all(session)
            log.debug("Retrieved %d todo item(s)", len(items))
            return [mappers.to_response(i) for i in items]

    def create_item(self, request: TodoItemRequest) -> TodoItemResponse:
        log.info("Creating todo item '%s'", request.title)
        with transaction() as session:
            item = mappers.to_entity(request)
            todo_item_repository.save(item, session)
            log.info("Todo item '%s' created with id %s", item.title, item.id)
            return mappers.to_response(item)

    def update_item(self, item_id: int, request: TodoItemRequest) -> TodoItemResponse:
        log.info("Updating todo item with id %s", item_id)
        with transaction() as session:
            item = todo_item_repository.find_by_id(item_id, session)
            if item is None:
                raise ResourceNotFoundError("TodoItem", item_id)
            item.title = request.title
            item.due_date = request.dueDate
            item.done = request.done
            item.sort_order = request.sortOrder
            item.updated_at = datetime.now(timezone.utc)
            todo_item_repository.save(item, session)
            return mappers.to_response(item)

    def delete_item(self, item_id: int) -> None:
        log.info("Deleting todo item with id %s", item_id)
        with transaction() as session:
            item = todo_item_repository.find_by_id(item_id, session)
            if item is None:
                raise ResourceNotFoundError("TodoItem", item_id)
            todo_item_repository.delete(item, session)

    def delete_done_items(self) -> int:
        log.info("Deleting all done todo items")
        with transaction() as session:
            count = todo_item_repository.delete_done(session)
            log.info("Deleted %d done todo item(s)", count)
            return count


todo_item_service = TodoItemService()
