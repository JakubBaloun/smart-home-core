# Coding Standards

> Python conventions as they are actually written in `backend-python/`.
>
> This describes the running code. The Quarkus source in `backend/` is the behavioural
> specification (what the API must do), never the style guide (how Python should look).

## Language and tooling

- Python **3.12** in the image (`python:3.12-slim`); `pyproject.toml` declares `requires-python = ">=3.11"`
- Dependencies live in `pyproject.toml` only — there is no `requirements.txt`, no lock file,
  and no Poetry/uv. Install with `pip install -e ".[test]"`.
- **No formatter and no linter are configured.** No `black`, `ruff`, `mypy`, or pre-commit hook
  exists in the repo. Match the surrounding file by hand rather than reformatting it.

## Formatting

- Lines wrap at roughly **100 columns**. A few `mapped_column(...)` definitions in
  `recipe/models.py` and `device/models.py` run to ~115; leave them.
- Four-space indent, double quotes, trailing commas in multi-line calls
- Imports: stdlib, third-party, then `app.*`, separated by blank lines, alphabetised within a group
- Absolute imports only (`from app.device.models import Device`). No relative imports anywhere.

## Typing

Type hints are used consistently and are not optional.

- Built-in generics and PEP 604 unions: `list[Device]`, `dict[str, Any]`, `str | None`.
  Do not import `List`, `Dict`, or `Optional`.
- `from typing import ...` appears only for `Any`, `Annotated`, `Generic`, `TypeVar`, `Mapping`
- Every function has annotated parameters and a return type, including `-> None`
- Repository/service methods annotate the SQLAlchemy `Session` parameter explicitly

## Docstrings

Short and purposeful. Most functions have none; the ones that do are explaining something
non-obvious, usually a Quarkus behaviour being reproduced.

- **Module docstring** on nearly every module, one or two lines, naming the Java class it
  mirrors: `"""Mirror of DeviceService."""`, `"""Mirror of RecipeResource / TagResource."""`
- **Function docstring** only where the behaviour is surprising. Good existing examples:

```python
def read_session() -> Iterator[Session]:
    """Equivalent of `sessionFactory.withSession` — no transaction commit."""

def _as_int(value: Any) -> int:
    """Jackson JsonNode.asInt() semantics — non-numeric nodes yield 0."""

def _parse_instant(value: str) -> datetime | None:
    """Instant.parse equivalent — an offset is mandatory, so naive values are rejected."""
```

- Never write `:param:`/`:return:` blocks or multi-paragraph prose. The type hints carry that.
- Inline `#` comments are reserved for parity traps, and they say *why*:

```python
# Java's `instanceof Number` excludes Boolean; Python's bool is an int.
if isinstance(raw, bool) or not isinstance(raw, (int, float)):
    return
```

## Naming

- Python code is `snake_case` throughout: modules, functions, variables, SQLAlchemy columns
- **Pydantic schema fields are `camelCase` on purpose** — `friendlyName`, `servingsBase`,
  `timerSeconds`, `ieeeAddress`. They are the wire format the frontend already consumes.
  Do not "fix" them to snake_case and do not paper over them with aliases.
- Mapper functions translate between the two: `device.friendly_name` → `DeviceResponse.friendlyName`
- Private module-level helpers are prefixed with `_` (`_now`, `_error`, `_camel`, `_factory`)

## Package structure

Feature-based packages that map one-to-one onto `io.smarthome.core.*`, layered inside each
feature. A Quarkus class and its Python counterpart are always in matching positions.

```
app/
  config.py            # pydantic-settings; equivalent of application.yaml
  db.py                # engine, read_session(), transaction()
  main.py              # FastAPI app, lifespan wiring, verify_schema(), uvicorn entrypoint
  common/              # exceptions, errors (handlers), pagination, events, datetimes
  device/
    models.py          # SQLAlchemy entity            <- Device.java
    schemas.py         # Pydantic request/response    <- resource/*Request.java, *Response.java
    repository.py      # data access                  <- repository/DeviceRepository.java
    service.py         # business logic               <- service/DeviceService.java
    router.py          # REST layer                   <- resource/DeviceResource.java
    mappers.py         # entity -> response           <- resource/DeviceMapper.java (MapStruct)
    z2m_mapper.py      # Z2M payload -> entity        <- service/mapper/Z2MDeviceMapper.java
    command_service.py, events.py
  telemetry/           # client, service, schemas, router, fields, events
  recipe/              # models, schemas, repository, service, router, mappers
  mqtt/                # client, consumers, publisher, bridge_state, state_payload, health
  automation/          # rule, rules/, registry, engine, bridge, scheduler, context
```

New feature: create the package, then add the files in that order. Do not introduce a different
layout for one feature.

## Dependency wiring

There is no DI container. Each module exports a **module-level singleton** created at import
time, and collaborators import it directly:

```python
class DeviceService:
    ...

device_service = DeviceService()
```

Existing singletons: `device_service`, `device_repository`, `device_command_service`,
`telemetry_service`, `recipe_service`, `tag_service`, `recipe_repository`, `tag_repository`,
`mqtt_publisher`, `bridge_state_holder`, `rule_registry`, `rule_engine`, `event_bus`.

Consequences to respect:

- Classes stay stateless (or hold only caches, like `DoorOpenedLightsRule._previous_state`)
- Tests substitute behaviour with `monkeypatch.setattr` on the singleton, not with a container
- The one constructor-injected collaborator is `RecipeService(tag_service)`; follow that shape
  if a service genuinely needs another service

## Logging

Standard library `logging`, one logger per module:

```python
log = logging.getLogger(__name__)
```

- `%`-style lazy formatting, never f-strings: `log.info("Device '%s' is now %s", name, state)`
- Levels follow the Quarkus code: read paths `debug`, mutations and lifecycle events `info`,
  recoverable problems `warning`, swallowed failures `error`
- `log.exception(...)` where a stack trace matters (event bus, rule engine, MQTT callbacks)
- `logging.basicConfig` is called once in `app/main.py`; do not configure logging elsewhere

## Errors

Domain exceptions live in `common/exceptions.py` and are translated to HTTP by handlers
registered in `common/errors.py`. Raise the domain exception from services and routers; never
build a `JSONResponse` by hand outside `common/errors.py`.

| Exception                 | Status | Body title            |
| ------------------------- | ------ | --------------------- |
| `ResourceNotFoundError`   | 404    | `Not Found`           |
| `DeviceUnavailableError`  | 409    | `Device Unavailable`  |
| `BadRequestError`         | 400    | `Bad Request`         |
| `TelemetryError`          | —      | internal, not mapped  |

The exact response shapes are a parity contract — see `parity-patterns.md`.

## Configuration

- All configuration is `pydantic-settings` in `app/config.py`. There is no YAML, no `.env` file
  in the repo, and no `os.environ` reads outside `config.py`, `main.py` and `tests/conftest.py`.
- Add a field to `Settings` with an explicit `alias` for the environment variable name, and a
  default that matches `docker-compose.dev.yaml` so local runs need no exported variables
- Nested config (`automation.*`) is a `BaseModel` on `Settings`; the delimiter is `__`
- Read settings via `get_settings()` (`@lru_cache`d) **inside** the function that needs them, not
  at import time — automation rules re-read config on every evaluation, and tests rely on that
- After mutating settings in a test, call `get_settings.cache_clear()`

## Database and migrations

- **Flyway in `backend/src/main/resources/db/migration/` owns the schema. There is no Alembic
  and must not be one.** Two migration tools against one database corrupts it.
- Schema change procedure: add `V{major}.{minor}.{patch}__Description.sql` in `backend/`, apply
  it, then re-snapshot `backend-python/schema.sql` (test bootstrap only, never a migration
  mechanism), then hand-edit the SQLAlchemy model to match
- Applied migrations are immutable — never edit one
- `main.verify_schema()` reflects the database at startup and fails fast if a table from
  `EXPECTED_TABLES` is missing. Add new tables to that set.

## General principles

- **The Quarkus code is the spec.** For any question about status codes, messages, JSON shapes
  or edge cases, read the Java and replicate it — including quirks. Do not infer from REST
  convention or improve on it silently.
- **Record ambiguities.** `backend-python/README.md` carries the running log of Quarkus
  behaviours that were non-obvious and how they were resolved. Append to it rather than
  re-deriving them.
- Follow the existing pattern in the neighbouring feature before inventing a new one
- Fail fast: validate at the edge (Pydantic schema or router), raise, let the handler map it
