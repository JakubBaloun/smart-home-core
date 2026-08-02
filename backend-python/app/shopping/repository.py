"""Data access for shopping_item."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.shopping.models import ShoppingItem


class ShoppingItemRepository:
    def find_by_id(self, item_id: int, session: Session) -> ShoppingItem | None:
        return session.get(ShoppingItem, item_id)

    def list_all(self, session: Session) -> list[ShoppingItem]:
        stmt = select(ShoppingItem).order_by(
            ShoppingItem.sort_order.asc(), ShoppingItem.id.asc()
        )
        return list(session.scalars(stmt))

    def save(self, item: ShoppingItem, session: Session) -> None:
        session.add(item)
        session.flush()

    def delete(self, item: ShoppingItem, session: Session) -> None:
        session.delete(item)
        session.flush()

    def delete_checked(self, session: Session) -> int:
        result = session.execute(delete(ShoppingItem).where(ShoppingItem.checked.is_(True)))
        return result.rowcount


shopping_item_repository = ShoppingItemRepository()
