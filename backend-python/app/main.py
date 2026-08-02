"""Application entrypoint — the Quarkus runtime's job: wire beans, open the
broker connection, start the scheduler."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import inspect

from app.automation import bridge, scheduler
from app.automation.registry import rule_registry
from app.common.errors import register_exception_handlers
from app.config import get_settings
from app.db import get_engine
from app.device.router import device_router
from app.mqtt import client as mqtt_client
from app.mqtt.health import health_router
from app.recipe.router import recipe_router, tag_router
from app.shopping.router import shopping_router
from app.telemetry.client import close_client
from app.telemetry.router import telemetry_router
from app.todo.router import todo_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)

log = logging.getLogger(__name__)

EXPECTED_TABLES = {
    "device",
    "device_alias",
    "recipe",
    "recipe_ingredient",
    "recipe_step",
    "tag",
    "recipe_tag",
    "shopping_item",
    "todo_item",
}


def verify_schema() -> None:
    """Flyway (Quarkus) owns the schema; this only fails fast if the database the
    Python backend points at was never migrated."""
    existing = set(inspect(get_engine()).get_table_names())
    missing = EXPECTED_TABLES - existing
    if missing:
        raise RuntimeError(
            f"Database schema is missing tables {sorted(missing)}. "
            "Run the Quarkus backend (Flyway) or apply schema.sql first."
        )
    log.info("Database schema verified (%d tables)", len(EXPECTED_TABLES))


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.schema_check_enabled:
        verify_schema()
    rule_registry.start()
    bridge.register()
    mqtt_client.start()
    scheduler.start()
    yield
    scheduler.stop()
    mqtt_client.stop()
    close_client()


app = FastAPI(title="Smart Home Core (Python)", lifespan=lifespan)

register_exception_handlers(app)

app.include_router(device_router)
app.include_router(telemetry_router)
app.include_router(recipe_router)
app.include_router(tag_router)
app.include_router(shopping_router)
app.include_router(todo_router)
app.include_router(health_router)


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=get_settings().http_port)


if __name__ == "__main__":
    main()
