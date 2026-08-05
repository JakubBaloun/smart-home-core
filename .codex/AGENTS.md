# Smart Home Core - Codex Context

## Critical Rules

- **ONLY commit and push when explicitly asked** - Do not commit unless user requests
- **Never run the production `docker-compose.yaml` on a dev machine without `-p <project>`** - it
  shares service names and the default project name with `docker-compose.dev.yaml` and will
  recreate the dev containers. The data itself now survives: the dev stack has its own named
  volumes (`db_data_dev`, `influxdb_data_dev`), deliberately suffixed so they can never resolve
  to the production `db_data` / `influxdb_data` in the same compose project.

## Project Overview

IoT smart home platform running on Raspberry Pi 5. Monorepo: Python/FastAPI backend
(`backend-python/`) + React frontend (`frontend/`), deployed via Docker Compose. Controls Zigbee
devices through Zigbee2MQTT and MQTT; device registry in PostgreSQL, telemetry in InfluxDB.

`backend/` holds the older Quarkus implementation. It is **no longer built, tested or deployed**,
but it is kept as the behavioural specification for the port and it owns the live Flyway
migrations, so it cannot be deleted.

**Main documentation:** See `/AGENTS.md` (a link to the root project context) for full project context,
tech stack, and conventions.

## Preferred Approach: Research → Plan → Execute → Explain

1. **Research** - Analyze existing code before proposing solutions
2. **Plan** - Create architectural plan, present for approval (use Plan Mode)
3. **Execute** - Implement systematically, mark todos complete immediately
4. **Explain** - Document decisions, help communicate to stakeholders

## Quick Reference

### Tech Stack Summary

- **Language:** Python 3.12 with FastAPI + Pydantic v2
- **Database:** PostgreSQL 17 (SQLAlchemy 2.0, sync) + InfluxDB 2.x (telemetry)
- **Messaging:** MQTT via paho-mqtt (Mosquitto + Zigbee2MQTT)
- **Scheduling:** APScheduler
- **Testing:** pytest + testcontainers (no DB mocking); Vitest (frontend)
- **Build:** pip / `pyproject.toml` (`backend-python/`); npm (`frontend/`)

### Common Commands

```bash
cd backend-python && pip install -e ".[test]"    # One-time setup
cd backend-python && python -m app.main          # Run on :8081
cd backend-python && pytest                      # Full suite
cd frontend && npm test && npm run build         # Frontend tests + build
docker compose -f docker-compose.dev.yaml up -d  # Local infra (postgres:5433, influx, mqtt)
```

### Configuration

- `backend-python/app/config.py` - pydantic-settings; defaults match `docker-compose.dev.yaml`
- Env var names match the old Quarkus ones (`DB_*`, `INFLUXDB_*`, `MQTT_*`)
- Flyway migrations: `backend/src/main/resources/db/migration/V{version}__{Description}.sql`
  (still the single source of truth for the schema — no Alembic)

### Architecture Pattern

- **Feature-based packages:** `device/`, `telemetry/`, `automation/`, `mqtt/`, `recipe/`
- **Layered within features:** `models.py` → `repository.py` → `service.py` → `router.py`
- **Synchronous** SQLAlchemy with explicit sessions
- **camelCase on the wire** - Pydantic schemas keep Jackson's field names for frontend parity

## Detailed Specifications

`.codex/specs/` documents the **running Python code** in `backend-python/`. It describes what is
actually there, not what would be ideal — follow it when writing code, and update it when the
code changes. `reactive-patterns.md` was deleted rather than translated: the port is deliberately
synchronous and had no Mutiny equivalent; `architecture-patterns.md` replaces it.

| Spec                        | Contents                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `backend-conventions.md`    | Python style, typing, docstrings, package layout, Flyway      |
| `frontend-conventions.md`   | Modules, tokens, routing, kiosk isolation, review checklist   |
| `architecture-patterns.md`  | Sync architecture, layering, sessions, wiring, parity contract |
| `mqtt-patterns.md`          | paho-mqtt, Zigbee2MQTT topics, consumers, commands            |
| `testing-patterns.md`       | pytest + testcontainers (backend), Vitest (frontend)          |
| `git-workflow.md`           | Commit format, PR rules (language-agnostic)                   |

`backend-python/README.md` is the authoritative port document: it carries the running log of
ambiguities found in the Quarkus code and how each was resolved. Add to it rather than
re-deriving them.

## Subagents

`.codex/agents/` holds the role definitions. Plan before implementing; review after.

| Agent           | When to use                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `architect`     | Non-trivial or cross-module work, or anything that could touch compose files, migrations or deployment — **before** any code |
| `be-dev`        | Implementing in `backend-python/` (endpoints, services, consumers, rules)    |
| `fe-dev`        | Implementing in `frontend/` (pages, components, routes, API clients)         |
| `code-reviewer` | Independent review after `be-dev`/`fe-dev` finish non-trivial work           |
| `ux-reviewer`   | After any frontend change with visual output, against `frontend/DESIGN.md`   |
| `researcher`    | Authoritative external-library facts (FastAPI, SQLAlchemy, paho-mqtt, React) |

Skip `architect` for typo fixes, one-line bug fixes, and tasks with one obvious
implementation — those go straight to `be-dev`/`fe-dev`. `/plan` delegates to `architect`;
`/review-commit` and `/review-pr` delegate to `code-reviewer` (plus `ux-reviewer` on visual
diffs).

## Critical Patterns (Quick Reference)

### Parity Patterns

- Datetimes use the annotated types in `app/common/datetimes.py`, never bare `datetime`
- `Decimal` fields serialize as JSON numbers (Jackson `BigDecimal` behaviour), not strings
- Validation 400s reproduce Quarkus' `ViolationReport` shape, including method-parameter paths
- Unparsable path params → 404, unparsable query params → 400

### Telemetry Pattern

- Numbers coerced to double, booleans left boolean, strings skipped
- Check `isinstance(x, bool)` **before** the numeric branch — Python's `bool` is an `int`

### Repository Pattern

- Repositories take an explicit SQLAlchemy `Session`
- No Panache/active-record equivalent; SQLAlchemy 2.0 `select()` style

### Testing Pattern

- `backend-python/tests/test_*.py`, mirroring the Quarkus test classes
- Never mock the database; testcontainers or `TEST_DB_URL`
- `MQTT_ENABLED=false` / `SCHEDULER_ENABLED=false` keep tests off brokers and timers

### Database Pattern

- All schema changes via Flyway migrations in `backend/`, then re-snapshot
  `backend-python/schema.sql`
- Migrations run in prod as the one-shot `smart-home-flyway` compose service
- Never modify schema directly

## Important Files

- `AGENTS.md` - Full project documentation (root level; links to `CLAUDE.md`)
- `backend-python/README.md` - Port notes, ambiguity log, deployment details
- `docker-compose.yaml` - Production stack; `docker-compose.dev.yaml` - local dev infra
- `backend-python/app/config.py` - Main configuration
- `backend/src/main/resources/db/migration/` - Database migrations
