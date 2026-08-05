# Architecture Patterns

> Replaces the old `reactive-patterns.md`. The Python port is deliberately **synchronous** —
> there is no Mutiny equivalent and nothing to translate. This documents the structure that
> actually exists in `backend-python/`.

## Why synchronous

Quarkus was reactive end to end: `Uni<T>`/`Multi<T>`, Hibernate Reactive, SmallRye Messaging.
The port dropped all of it on purpose:

- SQLAlchemy 2.0 is used in its **sync** flavour with `psycopg` (not `asyncpg`)
- Services open sessions with plain context managers and return plain objects
- paho-mqtt runs its own network thread and calls consumers synchronously
- APScheduler's `BackgroundScheduler` runs jobs on a worker thread

FastAPI is the only async surface, and it is used correctly by *not* being async: **route
handlers are declared `def`, not `async def`**, so Starlette runs them in a threadpool and
blocking database work never stalls the event loop.

```python
@device_router.get("/{device_id}", response_model=DeviceResponse)
def get_device_by_id(device_id: int) -> DeviceResponse:      # def, not async def
    return mappers.to_response(device_service.get_device_by_id(device_id))
```

The only `async def` in the application is the `lifespan` context manager and the exception
handlers in `common/errors.py`, both of which are non-blocking. **Do not add `async def` route
handlers** — they would run on the event loop and block it on the first query.

## Layering

Each feature is `models → repository → service → router`, and the arrows only point one way.

| Layer          | File            | Owns                                                        |
| -------------- | --------------- | ----------------------------------------------------------- |
| Model          | `models.py`     | SQLAlchemy mapping, hand-written against the Flyway schema  |
| Schema         | `schemas.py`    | Pydantic request/response, camelCase wire names, validation |
| Repository     | `repository.py` | `select()`/`update()`/`delete()`, takes a `Session`         |
| Service        | `service.py`    | Transactions, business rules, domain exceptions, events     |
| Router         | `router.py`     | HTTP shape, status codes, command dispatch                  |
| Mapper         | `mappers.py`    | Entity → response schema                                    |

Rules that hold across the codebase:

- Repositories **never** open a session or commit; the caller passes one in
- Services **always** open the session, via `read_session()` or `transaction()`
- Routers never touch a `Session` and never import a repository
- `mqtt/` and `automation/` call services, never repositories

## Sessions and transactions

`app/db.py` provides the only two entry points, both mirroring the Quarkus session factory:

```python
with read_session() as session:      # sessionFactory.withSession — no commit
    ...

with transaction() as session:       # sessionFactory.withTransaction — commit on success
    ...                              # rollback + re-raise on exception
```

- The engine is built with `pool_pre_ping=True` and `expire_on_commit=False`, so entities
  returned from a closed session are still readable — `DeviceService.get_all_devices()` relies
  on this to return ORM objects to the router
- There is **no per-request session dependency**. Do not add a FastAPI `Depends(get_db)`; it
  would give MQTT consumers and scheduled rules a different lifecycle from HTTP requests.
- One service method = one transaction. `RecipeService.create_recipe` persists the recipe,
  ingredients, steps, tags *and* loads the detail response inside a single `transaction()`.
- Helpers that must join a caller's transaction take the session explicitly —
  `TagService.find_or_create(name, session)` is the model to copy.
- `repository.save()`/`update()` are `session.add()` + `session.flush()`; the flush is what makes
  the generated `id` available before the transaction commits.

## SQLAlchemy 2.0 style

`select()` statements only — no `Query`, no `session.query()`, no Panache-style active record.

```python
def find_by_ieee_address(self, ieee_address: str, session: Session) -> Device | None:
    return session.scalars(
        select(Device).where(Device.ieee_address == ieee_address)
    ).one_or_none()

def list_all(self, session: Session) -> list[Device]:
    return list(session.scalars(select(Device)))
```

- Primary-key lookup uses `session.get(Model, id)`
- Bulk statements return a rowcount that callers act on:
  `update_availability` returns it so an unknown device is logged and ignored rather than failing
- Filters that may be absent are built as a **list of conditions** and splatted into `where(*...)`
  (`RecipeRepository._search_conditions`). Quarkus' HQL had to bind unused parameters; here the
  clause is simply omitted, which produces the same result set.
- Models are hand-written to match Flyway. `Base.metadata.create_all()` is never called in
  production — only `tests/conftest.py` loads `schema.sql`.

## Application wiring (`main.py`)

The `lifespan` context manager is the equivalent of the Quarkus runtime's startup, in this order:

```
verify_schema()          # fail fast if Flyway never ran (SCHEMA_CHECK_ENABLED=false to skip)
rule_registry.start()    # build and sort the rule list
bridge.register()        # subscribe automation to the event bus
mqtt_client.start()      # connect paho, add per-topic callbacks, loop_start()
scheduler.start()        # APScheduler, night-mode cron pinned to Europe/Prague
--- yield ---
scheduler.stop(); mqtt_client.stop(); close_client()
```

New cross-cutting components are started here and nowhere else. Routers are registered with
`app.include_router(...)` after `register_exception_handlers(app)`.

## Events (replacing CDI `Event<T>` / `@Observes`)

`common/events.py` is a synchronous in-process bus. It exists so producers stay decoupled from
`automation/`:

- Events are frozen dataclasses: `DevicesSyncedEvent`, `TelemetryReceivedEvent`
- Producers call `event_bus.publish(event)` — `DeviceService.sync_devices` after the
  transaction commits, `mqtt/consumers.consume_telemetry` after a successful Influx write
- `automation/bridge.register()` is the only subscriber; it converts events into `RuleContext`
  and calls `rule_engine.fire`
- `publish` catches and logs handler failures, so a broken rule cannot break device sync
- `subscribe` is **idempotent** — CDI registers exactly one observer per method, and tests
  re-register `bridge`, which would otherwise double-fire every rule

## Automation

- A rule subclasses `Rule` (or `AbstractThresholdRule`), sets a class-level `RuleMetadata`,
  and overrides `applies_to()`, `is_enabled()` and `evaluate()`
- `is_enabled()` reads `get_settings().automation.<rule>.enabled` at evaluation time, so config
  is live rather than captured at construction
- **New rules must be added to the explicit list in `automation/registry.py`.** There is no
  scanning to replace CDI's `@Any Instance<Rule>`; the list is sorted by `metadata.name` for a
  stable evaluation order, which CDI never guaranteed.
- `RuleEngine.fire` isolates each rule in a try/except — one failing rule must not stop the rest
- Rules publish commands through `device_command_service`, never through `mqtt_publisher` directly

## Parity contract (summary)

These are behavioural obligations, not style preferences. Breaking one produces a visible
difference from the Quarkus backend that the frontend can see.

- **Datetimes** use the annotated types in `common/datetimes.py`, never bare `datetime`.
  `OffsetDateTime` (device/recipe) prints the fewest fraction digits needed; `Instant`
  (telemetry) pads to a multiple of three. Pydantic's default six digits is a diff.
- **`Decimal` serialises as a JSON number** via `field_serializer` (Jackson `BigDecimal`),
  not as a string.
- **Validation 400s** reproduce Quarkus' `ViolationReport`:
  `{"title": "Constraint Violation", "status": 400, "violations": [{"field", "message"}]}`,
  where `field` is the full method-parameter path such as
  `createRecipe.request.steps[0].timerSeconds`. This is why list-emptiness checks are
  `field_validator`s carrying the Java message verbatim instead of Pydantic's `min_length`.
- **Unparsable path param → bare 404; unparsable query param → 400** (JAX-RS semantics).
- **Jackson node coercion** is reproduced deliberately: `_as_text` / `_as_int` in
  `device/router.py` and `_as_text` in `mqtt/state_payload.py`. `asInt()` on a non-numeric node
  yields `0`, and that is intentional.
- **`bool` before number.** Java's `instanceof Number` excludes `Boolean`; in Python
  `isinstance(True, int)` is `True`. Check `isinstance(x, bool)` first in
  `telemetry/service.normalize_fields` and `automation/rules/base.py`. Getting it wrong writes
  `1.0` instead of `true` and permanently fixes the InfluxDB field type.

`backend-python/README.md` is the authoritative record of these and carries the reasoning and
the empirical evidence for each. Read it before changing anything in this list, and append to it
when a new ambiguity is resolved.
