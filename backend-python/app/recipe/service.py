"""Mirror of RecipeService / TagService."""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.common.exceptions import ResourceNotFoundError
from app.common.pagination import PageResponse
from app.db import read_session, transaction
from app.recipe import mappers
from app.recipe.models import Recipe, Tag
from app.recipe.repository import recipe_repository, tag_repository
from app.recipe.schemas import (
    IngredientRequest,
    RecipeDetailResponse,
    RecipeListResponse,
    RecipeRequest,
    StepRequest,
)

log = logging.getLogger(__name__)

DEFAULT_SERVINGS_BASE = 4


class TagService:
    def get_all_tags(self) -> list[Tag]:
        with read_session() as session:
            tags = tag_repository.list_all(session)
            log.debug("Retrieved %d tags from the database", len(tags))
            return tags

    def create_tag(self, name: str) -> Tag:
        with transaction() as session:
            tag = self.find_or_create(name, session)
            log.info("Tag '%s' available with id %s", tag.name, tag.id)
            return tag

    def find_or_create(self, name: str, session: Session) -> Tag:
        """Session-scoped get-or-create so callers can reuse their own transaction."""
        existing = tag_repository.find_by_name(name, session)
        if existing is not None:
            return existing
        tag = Tag(name=name)
        tag_repository.save(tag, session)
        return tag


class RecipeService:
    def __init__(self, tag_service: TagService) -> None:
        self.tag_service = tag_service

    def search_recipes(
        self, search: str | None, tag_names: list[str] | None, page: int, size: int
    ) -> PageResponse[RecipeListResponse]:
        like_pattern = None if not search or not search.strip() else f"%{search.strip().lower()}%"
        distinct_tag_names = list(dict.fromkeys(tag_names or []))
        tag_count = len(distinct_tag_names)
        offset = page * size

        with read_session() as session:
            tag_ids = tag_repository.find_ids_by_names(distinct_tag_names, session)
            recipes = recipe_repository.search(like_pattern, tag_ids, tag_count, offset, size, session)
            total = recipe_repository.count_search(like_pattern, tag_ids, tag_count, session)
            items = [
                mappers.to_list_response(
                    recipe,
                    mappers.to_tag_response_list(
                        recipe_repository.find_tags_by_recipe_id(recipe.id, session)
                    ),
                )
                for recipe in recipes
            ]
            response = PageResponse.of(items, page, size, total)
            log.debug(
                "Retrieved %d recipe(s) (page %d of %d)",
                len(response.items),
                page,
                response.totalPages,
            )
            return response

    def get_recipe_by_id(self, recipe_id: int) -> RecipeDetailResponse:
        with read_session() as session:
            response = self._load_detail(recipe_id, session)
            log.debug("Recipe with id %s retrieved successfully", recipe_id)
            return response

    def create_recipe(self, request: RecipeRequest) -> RecipeDetailResponse:
        log.info("Creating recipe '%s'", request.title)
        with transaction() as session:
            recipe = mappers.to_entity(request)
            if recipe.servings_base is None:
                recipe.servings_base = DEFAULT_SERVINGS_BASE
            recipe_repository.save(recipe, session)
            self._persist_ingredients(recipe.id, request.ingredients, session)
            self._persist_steps(recipe.id, request.steps, session)
            self._persist_tags(recipe.id, request.tags, session)
            response = self._load_detail(recipe.id, session)
            log.info("Recipe '%s' created with id %s", response.title, response.id)
            return response

    def update_recipe(self, recipe_id: int, request: RecipeRequest) -> RecipeDetailResponse:
        log.info("Updating recipe with id %s", recipe_id)
        with transaction() as session:
            recipe = recipe_repository.find_by_id(recipe_id, session)
            if recipe is None:
                raise ResourceNotFoundError("Recipe", recipe_id)

            recipe.title = request.title
            recipe.description = request.description
            recipe.servings_base = (
                request.servingsBase if request.servingsBase is not None else DEFAULT_SERVINGS_BASE
            )
            recipe.prep_time_minutes = request.prepTimeMinutes
            recipe.cook_time_minutes = request.cookTimeMinutes
            recipe.notes = request.notes
            recipe.updated_at = datetime.now(timezone.utc)
            recipe_repository.update(recipe, session)

            recipe_repository.delete_ingredients_by_recipe_id(recipe_id, session)
            recipe_repository.delete_steps_by_recipe_id(recipe_id, session)
            recipe_repository.delete_tag_links_by_recipe_id(recipe_id, session)
            self._persist_ingredients(recipe_id, request.ingredients, session)
            self._persist_steps(recipe_id, request.steps, session)
            self._persist_tags(recipe_id, request.tags, session)

            response = self._load_detail(recipe_id, session)
            log.info("Recipe with id %s updated successfully", recipe_id)
            return response

    def delete_recipe(self, recipe_id: int) -> None:
        log.info("Deleting recipe with id %s", recipe_id)
        with transaction() as session:
            recipe = recipe_repository.find_by_id(recipe_id, session)
            if recipe is None:
                raise ResourceNotFoundError("Recipe", recipe_id)
            recipe_repository.delete(recipe, session)
            log.info("Recipe with id %s deleted successfully", recipe_id)

    def _load_detail(self, recipe_id: int, session: Session) -> RecipeDetailResponse:
        recipe = recipe_repository.find_by_id(recipe_id, session)
        if recipe is None:
            raise ResourceNotFoundError("Recipe", recipe_id)
        ingredients = [
            mappers.to_ingredient_response(i)
            for i in recipe_repository.find_ingredients_by_recipe_id(recipe_id, session)
        ]
        steps = [
            mappers.to_step_response(s)
            for s in recipe_repository.find_steps_by_recipe_id(recipe_id, session)
        ]
        tags = mappers.to_tag_response_list(
            recipe_repository.find_tags_by_recipe_id(recipe_id, session)
        )
        return mappers.to_detail_response(recipe, ingredients, steps, tags)

    def _persist_ingredients(
        self, recipe_id: int, ingredients: list[IngredientRequest], session: Session
    ) -> None:
        for index, request in enumerate(ingredients):
            entity = mappers.to_ingredient_entity(request)
            entity.recipe_id = recipe_id
            entity.sort_order = index
            recipe_repository.save_ingredient(entity, session)

    def _persist_steps(self, recipe_id: int, steps: list[StepRequest], session: Session) -> None:
        for index, request in enumerate(steps):
            entity = mappers.to_step_entity(request)
            entity.recipe_id = recipe_id
            entity.step_number = index + 1
            recipe_repository.save_step(entity, session)

    def _persist_tags(
        self, recipe_id: int, tag_names: list[str] | None, session: Session
    ) -> None:
        if not tag_names:
            return
        for name in dict.fromkeys(tag_names):
            tag = self.tag_service.find_or_create(name, session)
            recipe_repository.save_tag_link(recipe_id, tag.id, session)


tag_service = TagService()
recipe_service = RecipeService(tag_service)
