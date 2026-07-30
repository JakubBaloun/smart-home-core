"""Mirror of RecipeResource / TagResource."""

import logging

from fastapi import APIRouter, Query, Response

from app.common.pagination import PageResponse
from app.recipe import mappers
from app.recipe.schemas import (
    CreateTagRequest,
    RecipeDetailResponse,
    RecipeListResponse,
    RecipeRequest,
    TagResponse,
)
from app.recipe.service import recipe_service, tag_service

log = logging.getLogger(__name__)

MIN_SIZE = 1
MAX_SIZE = 100

recipe_router = APIRouter(prefix="/api/recipes", tags=["recipes"])
tag_router = APIRouter(prefix="/api/tags", tags=["tags"])


@recipe_router.get("", response_model=PageResponse[RecipeListResponse])
def search_recipes(
    search: str | None = None,
    tag: list[str] | None = Query(default=None),
    page: int = 0,
    size: int = 20,
) -> PageResponse[RecipeListResponse]:
    clamped_page = max(page, 0)
    clamped_size = min(max(size, MIN_SIZE), MAX_SIZE)
    log.info(
        "Request received to search recipes (search=%s, tags=%s, page=%d, size=%d)",
        search,
        tag,
        clamped_page,
        clamped_size,
    )
    return recipe_service.search_recipes(search, tag, clamped_page, clamped_size)


@recipe_router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe_by_id(recipe_id: int) -> RecipeDetailResponse:
    log.info("Request received to get recipe with id: %s", recipe_id)
    return recipe_service.get_recipe_by_id(recipe_id)


@recipe_router.post("", response_model=RecipeDetailResponse)
def create_recipe(request: RecipeRequest) -> RecipeDetailResponse:
    log.info("Request received to create recipe '%s'", request.title)
    return recipe_service.create_recipe(request)


@recipe_router.put("/{recipe_id}", response_model=RecipeDetailResponse)
def update_recipe(recipe_id: int, request: RecipeRequest) -> RecipeDetailResponse:
    log.info("Request received to update recipe with id: %s", recipe_id)
    return recipe_service.update_recipe(recipe_id, request)


@recipe_router.delete("/{recipe_id}", status_code=204, response_class=Response)
def delete_recipe(recipe_id: int) -> Response:
    log.info("Request received to delete recipe with id: %s", recipe_id)
    recipe_service.delete_recipe(recipe_id)
    return Response(status_code=204)


@tag_router.get("", response_model=list[TagResponse])
def get_all_tags() -> list[TagResponse]:
    log.info("Request received to get all tags")
    return mappers.to_tag_response_list(tag_service.get_all_tags())


@tag_router.post("", response_model=TagResponse)
def create_tag(request: CreateTagRequest) -> TagResponse:
    log.info("Request received to create tag '%s'", request.name)
    return mappers.to_tag_response(tag_service.create_tag(request.name))
