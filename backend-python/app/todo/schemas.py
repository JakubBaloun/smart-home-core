"""Pydantic schemas for the todo list endpoints."""

from datetime import date

from pydantic import BaseModel, field_validator

from app.common.datetimes import OffsetDateTime


def _not_blank(value: str, field: str) -> str:
    if value is None or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value


class TodoItemRequest(BaseModel):
    title: str
    dueDate: date | None = None
    done: bool = False
    sortOrder: int = 0

    @field_validator("title")
    @classmethod
    def _validate_title(cls, v: str) -> str:
        return _not_blank(v, "title")


class TodoItemResponse(BaseModel):
    id: int
    title: str
    dueDate: date | None
    done: bool
    sortOrder: int
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
