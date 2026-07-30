"""Pydantic equivalents of the recipe DTO records.

Field names are camelCase on purpose: they are the wire format the Quarkus
backend emits and the frontend consumes, and keeping them literal removes a
whole class of alias mistakes. SQLAlchemy models stay snake_case.
"""

from decimal import Decimal

from pydantic import BaseModel, field_serializer, field_validator

from app.common.datetimes import OffsetDateTime
from app.recipe.models import IngredientUnit


def _not_blank(value: str, field: str) -> str:
    if value is None or not value.strip():
        raise ValueError(f"{field} must not be blank")
    return value


class IngredientRequest(BaseModel):
    name: str
    amount: Decimal
    unit: IngredientUnit | None = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return _not_blank(v, "name")

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class StepRequest(BaseModel):
    title: str | None = None
    content: str
    timerSeconds: int | None = None

    @field_validator("content")
    @classmethod
    def _validate_content(cls, v: str) -> str:
        return _not_blank(v, "content")

    @field_validator("timerSeconds")
    @classmethod
    def _validate_timer(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("timerSeconds must be positive when present")
        return v


class RecipeRequest(BaseModel):
    title: str
    description: str | None = None
    servingsBase: int | None = None
    prepTimeMinutes: int | None = None
    cookTimeMinutes: int | None = None
    notes: str | None = None
    ingredients: list[IngredientRequest]
    steps: list[StepRequest]
    tags: list[str] | None = None

    @field_validator("ingredients")
    @classmethod
    def _validate_ingredients(cls, v: list[IngredientRequest]) -> list[IngredientRequest]:
        if not v:
            raise ValueError("recipe must have at least one ingredient")
        return v

    @field_validator("steps")
    @classmethod
    def _validate_steps(cls, v: list[StepRequest]) -> list[StepRequest]:
        if not v:
            raise ValueError("recipe must have at least one step")
        return v

    @field_validator("title")
    @classmethod
    def _validate_title(cls, v: str) -> str:
        return _not_blank(v, "title")

    @field_validator("servingsBase")
    @classmethod
    def _validate_servings(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("servingsBase must be positive")
        return v


class CreateTagRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return _not_blank(v, "name")


class TagResponse(BaseModel):
    id: int
    name: str


class RecipeIngredientResponse(BaseModel):
    id: int
    name: str
    amount: Decimal
    unit: IngredientUnit | None
    sortOrder: int

    # Jackson writes BigDecimal as a JSON number; Pydantic would write a string.
    @field_serializer("amount")
    def _serialize_amount(self, value: Decimal) -> float:
        return float(value)


class RecipeStepResponse(BaseModel):
    id: int
    stepNumber: int
    title: str | None
    content: str
    timerSeconds: int | None


class RecipeListResponse(BaseModel):
    id: int
    title: str
    servingsBase: int
    prepTimeMinutes: int | None
    cookTimeMinutes: int | None
    tags: list[TagResponse]


class RecipeDetailResponse(BaseModel):
    id: int
    title: str
    description: str | None
    servingsBase: int
    prepTimeMinutes: int | None
    cookTimeMinutes: int | None
    notes: str | None
    ingredients: list[RecipeIngredientResponse]
    steps: list[RecipeStepResponse]
    tags: list[TagResponse]
    createdAt: OffsetDateTime
    updatedAt: OffsetDateTime
