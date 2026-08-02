import os
import pathlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

SCHEMA_SQL = pathlib.Path(__file__).resolve().parents[1] / "schema.sql"

# The MQTT broker, the scheduler and InfluxDB are not part of the REST parity
# tests; the Quarkus test profile switches the same channels to the in-memory
# connector for the same reason.
os.environ.setdefault("MQTT_ENABLED", "false")
os.environ.setdefault("SCHEDULER_ENABLED", "false")


@pytest.fixture(scope="session")
def database_url() -> str:
    """TEST_DB_URL must point at a throwaway database — the schema is recreated."""
    url = os.environ.get("TEST_DB_URL")
    if url:
        yield url
        return

    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:17-alpine", driver="psycopg") as container:
        yield container.get_connection_url()


@pytest.fixture(scope="session", autouse=True)
def _database(database_url):
    from app import db
    from app.config import get_settings

    os.environ["DB_URL"] = database_url
    get_settings.cache_clear()

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
        connection.execute(text(SCHEMA_SQL.read_text()))
    engine.dispose()

    db.init_engine(database_url)
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    from app.db import transaction

    yield
    with transaction() as session:
        session.execute(
            text(
                "TRUNCATE recipe_tag, recipe_ingredient, recipe_step, recipe, tag, "
                "device_alias, device, shopping_item, todo_item RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
