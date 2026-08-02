"""Data access for todo_item."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.todo.models import TodoItem


class TodoItemRepository:
    def find_by_id(self, item_id: int, session: Session) -> TodoItem | None:
        return session.get(TodoItem, item_id)

    def list_all(self, session: Session) -> list[TodoItem]:
        stmt = select(TodoItem).order_by(TodoItem.sort_order.asc(), TodoItem.id.asc())
        return list(session.scalars(stmt))

    def save(self, item: TodoItem, session: Session) -> None:
        session.add(item)
        session.flush()

    def delete(self, item: TodoItem, session: Session) -> None:
        session.delete(item)
        session.flush()

    def delete_done(self, session: Session) -> int:
        result = session.execute(delete(TodoItem).where(TodoItem.done.is_(True)))
        return result.rowcount


todo_item_repository = TodoItemRepository()
