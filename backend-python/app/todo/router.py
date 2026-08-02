"""REST layer for /api/todo-items."""

import logging

from fastapi import APIRouter, Response

from app.todo.schemas import TodoItemRequest, TodoItemResponse
from app.todo.service import todo_item_service

log = logging.getLogger(__name__)

todo_router = APIRouter(prefix="/api/todo-items", tags=["todo-items"])


@todo_router.get("", response_model=list[TodoItemResponse])
def list_todo_items() -> list[TodoItemResponse]:
    log.info("Request received to list todo items")
    return todo_item_service.list_items()


@todo_router.post("", response_model=TodoItemResponse)
def create_todo_item(request: TodoItemRequest) -> TodoItemResponse:
    log.info("Request received to create todo item '%s'", request.title)
    return todo_item_service.create_item(request)


# order matters: /done must precede /{item_id}, else FastAPI tries to parse "done" as int
@todo_router.delete("/done", status_code=204, response_class=Response)
def delete_done_todo_items() -> Response:
    log.info("Request received to delete all done todo items")
    todo_item_service.delete_done_items()
    return Response(status_code=204)


@todo_router.put("/{item_id}", response_model=TodoItemResponse)
def update_todo_item(item_id: int, request: TodoItemRequest) -> TodoItemResponse:
    log.info("Request received to update todo item with id: %s", item_id)
    return todo_item_service.update_item(item_id, request)


@todo_router.delete("/{item_id}", status_code=204, response_class=Response)
def delete_todo_item(item_id: int) -> Response:
    log.info("Request received to delete todo item with id: %s", item_id)
    todo_item_service.delete_item(item_id)
    return Response(status_code=204)
