"""Mirror of RecipeRepository / TagRepository.

The Quarkus HQL binds `:search` / `:tagCount` even when unused (Hibernate
cannot skip clauses); here the equivalent clauses are simply omitted when the
filter is absent, which produces the same result set.
"""

from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.recipe.models import Recipe, RecipeIngredient, RecipeStep, RecipeTag, Tag


class RecipeRepository:
    @staticmethod
    def _search_conditions(search: str | None, tag_ids: list[int], tag_count: int):
        conditions = []
        if search is not None:
            ingredient_match = exists(
                select(RecipeIngredient.id).where(
                    RecipeIngredient.recipe_id == Recipe.id,
                    func.lower(RecipeIngredient.name).like(search),
                )
            )
            conditions.append(func.lower(Recipe.title).like(search) | ingredient_match)
        if tag_count != 0:
            matching_tags = (
                select(func.count())
                .select_from(RecipeTag)
                .where(RecipeTag.recipe_id == Recipe.id, RecipeTag.tag_id.in_(tag_ids))
                .scalar_subquery()
            )
            conditions.append(matching_tags == tag_count)
        return conditions

    def find_by_id(self, recipe_id: int, session: Session) -> Recipe | None:
        return session.get(Recipe, recipe_id)

    def search(
        self,
        search: str | None,
        tag_ids: list[int],
        tag_count: int,
        offset: int,
        limit: int,
        session: Session,
    ) -> list[Recipe]:
        stmt = (
            select(Recipe)
            .where(*self._search_conditions(search, tag_ids, tag_count))
            .order_by(Recipe.title.asc())
            .offset(offset)
            .limit(limit)
        )
        return list(session.scalars(stmt))

    def count_search(
        self, search: str | None, tag_ids: list[int], tag_count: int, session: Session
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(Recipe)
            .where(*self._search_conditions(search, tag_ids, tag_count))
        )
        return session.scalar(stmt) or 0

    def save(self, recipe: Recipe, session: Session) -> None:
        session.add(recipe)
        session.flush()

    def update(self, recipe: Recipe, session: Session) -> None:
        session.add(recipe)
        session.flush()

    def delete(self, recipe: Recipe, session: Session) -> None:
        session.delete(recipe)
        session.flush()

    def find_ingredients_by_recipe_id(self, recipe_id: int, session: Session) -> list[RecipeIngredient]:
        stmt = (
            select(RecipeIngredient)
            .where(RecipeIngredient.recipe_id == recipe_id)
            .order_by(RecipeIngredient.sort_order)
        )
        return list(session.scalars(stmt))

    def find_steps_by_recipe_id(self, recipe_id: int, session: Session) -> list[RecipeStep]:
        stmt = (
            select(RecipeStep)
            .where(RecipeStep.recipe_id == recipe_id)
            .order_by(RecipeStep.step_number)
        )
        return list(session.scalars(stmt))

    def find_tags_by_recipe_id(self, recipe_id: int, session: Session) -> list[Tag]:
        stmt = (
            select(Tag)
            .where(Tag.id.in_(select(RecipeTag.tag_id).where(RecipeTag.recipe_id == recipe_id)))
            .order_by(Tag.name)
        )
        return list(session.scalars(stmt))

    def save_ingredient(self, ingredient: RecipeIngredient, session: Session) -> None:
        session.add(ingredient)
        session.flush()

    def save_step(self, step: RecipeStep, session: Session) -> None:
        session.add(step)
        session.flush()

    def save_tag_link(self, recipe_id: int, tag_id: int, session: Session) -> None:
        session.add(RecipeTag(recipe_id=recipe_id, tag_id=tag_id))
        session.flush()

    def delete_ingredients_by_recipe_id(self, recipe_id: int, session: Session) -> int:
        result = session.execute(
            delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
        )
        return result.rowcount

    def delete_steps_by_recipe_id(self, recipe_id: int, session: Session) -> int:
        result = session.execute(delete(RecipeStep).where(RecipeStep.recipe_id == recipe_id))
        return result.rowcount

    def delete_tag_links_by_recipe_id(self, recipe_id: int, session: Session) -> int:
        result = session.execute(delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id))
        return result.rowcount


class TagRepository:
    def list_all(self, session: Session) -> list[Tag]:
        return list(session.scalars(select(Tag).order_by(Tag.name)))

    def find_by_name(self, name: str, session: Session) -> Tag | None:
        return session.scalars(select(Tag).where(Tag.name == name)).one_or_none()

    def find_ids_by_names(self, names: list[str], session: Session) -> list[int]:
        if not names:
            return []
        return list(session.scalars(select(Tag.id).where(Tag.name.in_(names))))

    def save(self, tag: Tag, session: Session) -> None:
        session.add(tag)
        session.flush()


recipe_repository = RecipeRepository()
tag_repository = TagRepository()
