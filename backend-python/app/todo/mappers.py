"""Mapper functions between TodoItem and its Pydantic DTOs."""

from app.todo.models import TodoItem
from app.todo.schemas import TodoItemRequest, TodoItemResponse


def to_entity(request: TodoItemRequest) -> TodoItem:
    return TodoItem(
        title=request.title,
        due_date=request.dueDate,
        done=request.done,
        sort_order=request.sortOrder,
    )


def to_response(item: TodoItem) -> TodoItemResponse:
    return TodoItemResponse(
        id=item.id,
        title=item.title,
        dueDate=item.due_date,
        done=item.done,
        sortOrder=item.sort_order,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )
