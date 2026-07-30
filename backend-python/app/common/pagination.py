import math
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    page: int
    size: int
    totalElements: int
    totalPages: int

    @classmethod
    def of(cls, items: list[T], page: int, size: int, total_elements: int) -> "PageResponse[T]":
        total_pages = 0 if size == 0 else math.ceil(total_elements / size)
        return cls(
            items=items,
            page=page,
            size=size,
            totalElements=total_elements,
            totalPages=total_pages,
        )
