# Smart Home Core

IoT smart home platform running on Raspberry Pi 5. Monorepo: Python/FastAPI backend +
React frontend, deployed via Docker Compose. Controls Zigbee devices through Zigbee2MQTT and
MQTT; device registry in PostgreSQL, telemetry in InfluxDB.

## The two backends

`backend-python/` is the **running backend**. It is a faithful 1:1 port of the older Quarkus
backend in `backend/`, which is no longer built, tested or deployed.

Quarkus is kept in the repo for two reasons, and only these:

1. **It is the behavioural specification.** When a question about intended behaviour comes up
   (validation messages, JSON shapes, status codes, edge cases), read the Java and replicate it
   — do not infer from general REST conventions.
2. **It owns the Flyway migrations** at `backend/src/main/resources/db/migration/`, which
   `docker-compose.yaml` mounts. `backend/` therefore cannot simply be deleted.

Never run both backends against the same MQTT broker for more than a short parity check: they
subscribe to the same topics, so telemetry is written twice and automation rules fire twice,
sending duplicate commands to real devices.

## Tech Stack

- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (sync), pydantic-settings,
  APScheduler (in `backend-python/`)
- **Frontend:** React 19 + TypeScript + Vite, Recharts, Vitest (in `frontend/`)
- **Device registry:** PostgreSQL 17 — SQLAlchemy models hand-written against the Flyway schema
- **Telemetry:** InfluxDB 2.x (`influxdb-client`)
- **Messaging:** MQTT via Eclipse Mosquitto 2 + paho-mqtt (single connection, client id `smart-home-py`)
- **Zigbee:** Zigbee2MQTT (Sonoff Zigbee 3.0 USB Dongle Plus V2)
- **Testing:** pytest + testcontainers, no DB mocking (backend); Vitest + Testing Library (frontend)
- **Deployment:** Docker Compose on self-hosted GitHub Actions runner (Pi 5)

## Repository Layout

```
backend-python/                   # FastAPI application (the one that runs)
  app/
    config.py                     # pydantic-settings; env-var equivalent of application.yaml
    db.py                         # SQLAlchemy engine + session helpers
    main.py                       # FastAPI app, lifespan wiring, uvicorn entrypoint,
                                  #   verify_schema() fail-fast on unmigrated DB
    common/                       # exceptions + handlers, pagination, event bus,
                                  #   datetimes.py (Jackson-compatible serializers)
    device/                       # models, schemas, repository, service, router,
                                  #   command_service, z2m_mapper, mappers
    telemetry/                    # influx client, service, schemas, router, fields, events
    recipe/                       # models, schemas, repository, service, router
    mqtt/                         # paho client, consumers, publisher, bridge state, health
    automation/                   # rule base, rules/, registry, engine, bridge, scheduler
  schema.sql                      # verbatim snapshot of the Flyway result (test bootstrap only)
  tests/                          # pytest mirror of the Quarkus test classes
  README.md                       # port notes + log of Quarkus ambiguities and their resolutions
backend/                          # Quarkus application — SPEC ONLY, not deployed
  src/main/java/io/smarthome/core/   # the reference implementation
  src/main/resources/db/migration/   # Flyway migrations (V{x.y.z}__Description.sql) — LIVE
frontend/                         # React dashboard (nginx serves it in prod, proxies /api)
infra/mosquitto/mosquitto.conf    # Broker config (mounted by both compose files)
bruno/                            # Bruno API collection
docker-compose.yaml               # Production stack (app, frontend, flyway, postgres, influxdb,
                                  #   mosquitto, zigbee2mqtt) — env from /home/jakub/.env on the Pi
docker-compose.dev.yaml           # Local dev infra: postgres (host port 5433!), influxdb, mosquitto
.github/workflows/deploy.yml      # Push to main: test + build + compose up on the Pi
.github/workflows/python-ci.yml   # Pull requests only: pytest
```

## Common Commands

```bash
# Backend (run inside backend-python/)
pip install -e ".[test]"                # One-time setup
python -m app.main                      # Run on http://localhost:8081
pytest                                  # Full suite (spins up postgres via testcontainers)
pytest tests/test_device_api.py         # Single test module
TEST_DB_URL=postgresql+psycopg://smarthome:smarthome@localhost:5433/smarthome_py_test pytest

# Frontend (run inside frontend/)
npm run dev                             # Vite dev server (proxies /api to localhost:8081)
npm test                                # Vitest
npm run build                           # Production build

# Local infrastructure (repo root)
docker compose -f docker-compose.dev.yaml up -d   # postgres:5433, influxdb:8086, mosquitto:1883

# Simulating Zigbee2MQTT locally
docker exec mqtt-broker-dev mosquitto_sub -v -t 'zigbee2mqtt/#'
docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/temp -m '{"temperature":25.5}'
```

**Never run the production `docker-compose.yaml` from the repo root on a dev machine.** It shares
the default compose project name and service names with `docker-compose.dev.yaml`, so it recreates
the dev containers — and the dev stack declares no volumes, so its data is lost. Use `-p <name>`.

## Architecture & Conventions

### MQTT topics (Zigbee2MQTT contract)

- `zigbee2mqtt/bridge/devices` (retained) → device discovery/sync into PostgreSQL
- `zigbee2mqtt/bridge/state` → bridge state + readiness health check (`/q/health`)
- `zigbee2mqtt/<friendly_name>` → telemetry into InfluxDB
- `zigbee2mqtt/<friendly_name>/availability` → device availability (needs Z2M availability feature)
- `zigbee2mqtt/<friendly_name>/set` ← outgoing commands

Quarkus opened five SmallRye channels; the port uses one paho connection with
`message_callback_add` per topic filter. Subscriptions are re-established in `on_connect`, so a
broker restart does not silently stop delivery.

### Critical invariants

- **Telemetry fields are always written to InfluxDB as double** (booleans stay boolean,
  strings are skipped). InfluxDB fixes a field's type on first write per shard; mixed
  int/float writes are silently rejected otherwise. Do not remove the coercion in
  `telemetry/service.py`.
- **`bool` must be checked before the numeric branch.** Java's `instanceof Number` excludes
  `Boolean`, but in Python `isinstance(True, int)` is `True`. Getting this wrong writes `1.0`
  instead of `true` and permanently fixes the InfluxDB field type. Applies in
  `telemetry/service.py` and `automation/rules/base.py`.
- **Availability is owned by the availability topic**, not by device sync:
  `z2m_mapper.update_entity_from_payload` must not touch `available`/`last_seen`.
- **Datetimes use the annotated types in `common/datetimes.py`**, never bare `datetime`.
  Quarkus emits two different fraction formats and the frontend sees both: `OffsetDateTime`
  (device/recipe) prints the fewest digits needed, `Instant` (telemetry) pads to a multiple of
  three. Pydantic's default six digits is a visible parity break.
- **New automation rules must be added to the explicit list in `automation/registry.py`** —
  there is no scanning. It is sorted by name for a stable evaluation order.

### Code style

- Feature-based packages mirroring `io.smarthome.core.*` one-to-one, layered within features
  (`models` → `repository` → `service` → `router`)
- Synchronous SQLAlchemy 2.0 with explicit sessions; no async DB layer
- Pydantic v2 schemas; field names stay **camelCase on the wire** to match Jackson
- REST: `router.py` per feature, kebab-case paths
- Logging via the stdlib `logging` module (read paths at debug, mutations/events at info)

### Configuration

- `pydantic-settings` in `app/config.py`; defaults match the Quarkus `%dev` profile and
  `docker-compose.dev.yaml` (postgres on **5433**, influx token `dev-token`, org `smart-home`),
  so local runs need no exported vars
- Env var names match Quarkus (`DB_*`, `INFLUXDB_*`, `MQTT_*`) plus Python-only switches:
  `HTTP_PORT`, `MQTT_ENABLED`, `SCHEDULER_ENABLED`, `SCHEMA_CHECK_ENABLED`, `MQTT_CLIENT_ID`, `DB_URL`
- Production env vars come from `/home/jakub/.env` on the Pi (not in repo)

### Database

- **Flyway is the single owner of the schema. No Alembic.** All schema changes go in
  `backend/src/main/resources/db/migration/` as usual; then re-snapshot `backend-python/schema.sql`.
- Migrations run in production as the one-shot `smart-home-flyway` compose service, gated on the
  `smart-home-db` healthcheck; the app waits for `service_completed_successfully`. Quarkus used to
  do this in-process via `QUARKUS_FLYWAY_MIGRATE_AT_START`.
- SQLAlchemy models are hand-written to match. `verify_schema()` fails fast on startup if a table
  is missing (`SCHEMA_CHECK_ENABLED=false` to skip).

### Testing

- pytest in `backend-python/tests/`, mirroring the Quarkus test classes
- **The database is never mocked.** testcontainers spins up postgres, or set `TEST_DB_URL` to use
  an existing one (required inside Docker, where Docker-in-Docker is unavailable)
- The suite drops and recreates the `public` schema from `schema.sql` once per run and truncates
  between tests
- `MQTT_ENABLED=false` / `SCHEDULER_ENABLED=false` keep tests off real brokers and timers

### Deployment

- Push to `main` = production deploy (self-hosted runner on the Pi, no staging).
  **Never commit or push unless explicitly asked.**
- `deploy.yml` gates on the pytest suite and the frontend tests, then `docker compose up -d`.
  It does **not** build or test `backend/`.
- Prod images: `backend-python/Dockerfile` (multi-stage `base`/`test`/`runtime`; the runtime
  image ships without `tests/`, so CI mounts the checkout over `/app`), `frontend/Dockerfile` (nginx)
- nginx proxies `/api` to `smart-home-app:8081`
- Mosquitto/Zigbee2MQTT bind-mount dirs on the Pi — the workflow's cleanup step must run
  before checkout
