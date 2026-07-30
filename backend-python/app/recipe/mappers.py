"""Mirror of RecipeMapper / TagMapper (MapStruct) — entity <-> DTO."""

from app.recipe.models import Recipe, RecipeIngredient, RecipeStep, Tag
from app.recipe.schemas import (
    IngredientRequest,
    RecipeDetailResponse,
    RecipeIngredientResponse,
    RecipeListResponse,
    RecipeStepResponse,
    RecipeRequest,
    StepRequest,
    TagResponse,
)


def to_entity(request: RecipeRequest) -> Recipe:
    return Recipe(
        title=request.title,
        description=request.description,
        servings_base=request.servingsBase,
        prep_time_minutes=request.prepTimeMinutes,
        cook_time_minutes=request.cookTimeMinutes,
        notes=request.notes,
    )


def to_ingredient_entity(request: IngredientRequest) -> RecipeIngredient:
    return RecipeIngredient(
        name=request.name,
        amount=request.amount,
        unit=request.unit.value if request.unit else None,
    )


def to_step_entity(request: StepRequest) -> RecipeStep:
    return RecipeStep(
        title=request.title,
        content=request.content,
        timer_seconds=request.timerSeconds,
    )


def to_ingredient_response(ingredient: RecipeIngredient) -> RecipeIngredientResponse:
    return RecipeIngredientResponse(
        id=ingredient.id,
        name=ingredient.name,
        amount=ingredient.amount,
        unit=ingredient.unit,
        sortOrder=ingredient.sort_order,
    )


def to_step_response(step: RecipeStep) -> RecipeStepResponse:
    return RecipeStepResponse(
        id=step.id,
        stepNumber=step.step_number,
        title=step.title,
        content=step.content,
        timerSeconds=step.timer_seconds,
    )


def to_tag_response(tag: Tag) -> TagResponse:
    return TagResponse(id=tag.id, name=tag.name)


def to_tag_response_list(tags: list[Tag]) -> list[TagResponse]:
    return [to_tag_response(tag) for tag in tags]


def to_list_response(recipe: Recipe, tags: list[TagResponse]) -> RecipeListResponse:
    return RecipeListResponse(
        id=recipe.id,
        title=recipe.title,
        servingsBase=recipe.servings_base,
        prepTimeMinutes=recipe.prep_time_minutes,
        cookTimeMinutes=recipe.cook_time_minutes,
        tags=tags,
    )


def to_detail_response(
    recipe: Recipe,
    ingredients: list[RecipeIngredientResponse],
    steps: list[RecipeStepResponse],
    tags: list[TagResponse],
) -> RecipeDetailResponse:
    return RecipeDetailResponse(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servingsBase=recipe.servings_base,
        prepTimeMinutes=recipe.prep_time_minutes,
        cookTimeMinutes=recipe.cook_time_minutes,
        notes=recipe.notes,
        ingredients=ingredients,
        steps=steps,
        tags=tags,
        createdAt=recipe.created_at,
        updatedAt=recipe.updated_at,
    )
