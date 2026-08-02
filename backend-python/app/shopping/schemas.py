"""Pydantic schemas for the shopping list endpoints."""

from pydantic import BaseModel, field_validator

from app.common.datetimes import OffsetDateTime


def _not_blank(value: str, field: str) -> str:
    if value is None or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value


class ShoppingItemRequest(BaseModel):
    name: str
    quantity: str | None = None
    checked: bool = False
    sortOrder: int = 0

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return _not_blank(v, "name")


class ShoppingItemResponse(BaseModel):
    id: int
    name: str
    quantity: str | None
    checked: bool
    sortOrder: int
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
