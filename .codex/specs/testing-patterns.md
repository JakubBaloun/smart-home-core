# Testing Patterns

> Two independent suites: **pytest** for `backend-python/`, **Vitest** for `frontend/`. They
> share no tooling and run separately; both gate the deploy workflow.
>
> Backend first, then [Frontend tests (Vitest)](#frontend-tests-vitest).

# Backend — pytest

> pytest conventions as they exist in `backend-python/tests/`. There is one suite — no unit /
> integration split, no `*IT` equivalent, and nothing is skipped by default.

## Running

```bash
cd backend-python
pytest                                  # spins up postgres:17-alpine via testcontainers
pytest tests/test_device_api.py         # one module
pytest -k threshold                     # by name
pytest -q                               # what CI runs

# Use an existing database instead of testcontainers (required inside Docker,
# where Docker-in-Docker is not available):
TEST_DB_URL=postgresql+psycopg://smarthome:smarthome@localhost:5433/smarthome_py_test pytest
```

`TEST_DB_URL` must point at a **throwaway** database — `conftest.py` drops and recreates the
`public` schema.

Configuration is `[tool.pytest.ini_options]` in `pyproject.toml`: `testpaths = ["tests"]` and
`filterwarnings = ["ignore::DeprecationWarning"]`. There is no `pytest.ini`, no coverage gate,
and no custom markers.

## Layout

Test modules mirror the Quarkus test classes, not the Python package tree. Each starts with a
docstring naming what it mirrors.

| Module                       | Mirrors                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `test_device_api.py`         | `DeviceResourceTest`, `CommandResourceTest`                 |
| `test_device_repository.py`  | `DeviceRepositoryTest`, `DeviceCommandServiceTest`          |
| `test_recipe_api.py`         | `RecipeResourceTest`, `TagResourceTest`                     |
| `test_telemetry_api.py`      | `TelemetryResourceTest`                                     |
| `test_telemetry_service.py`  | `TelemetryServiceTest`                                      |
| `test_mqtt_consumers.py`     | `DeviceDiscoveryConsumerTest`, `TelemetryConsumerTest`      |
| `test_automation.py`         | `RuleEngineTest`, `RuleRegistryTest`, `RuleEventBridgeTest`, rule tests |
| `test_z2m_mapper.py`         | `Z2MDeviceMapperTest`                                       |
| `test_datetimes.py`          | (no Java equivalent — guards the Jackson fraction formats)  |

Plain `def test_...` functions. No test classes, no `unittest.TestCase`, no `assertEqual` —
bare `assert`.

## The database is never mocked

This is the strongest rule in the suite. `conftest.py` provides:

1. `database_url` (session-scoped) — `TEST_DB_URL` if set, otherwise a `PostgresContainer`
2. `_database` (session-scoped, autouse) — sets `DB_URL`, calls `get_settings.cache_clear()`,
   drops and recreates `public`, executes `schema.sql`, then `db.init_engine(url)`
3. `clean_tables` (function-scoped, autouse) — `TRUNCATE ... RESTART IDENTITY CASCADE` after
   every test, so ids start at 1 and tests never see each other's rows

`schema.sql` is a verbatim snapshot of the Flyway result and is used **only** here. It is not a
migration mechanism; when a Flyway migration is added in `backend/`, re-snapshot it.

Do not introduce a mocked or in-memory session, and do not use SQLite.

## HTTP tests

`client` is a `fastapi.testclient.TestClient` used as a context manager, so the real `lifespan`
runs — `verify_schema()`, the rule registry, the event-bus subscriptions. MQTT and the scheduler
are off (see below).

```python
def test_get_device_not_found(client):
    response = client.get("/api/devices/999999")
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "Device with id '999999' not found",
        "status": 404,
    }
```

- Assert the **whole body** for error responses. The shape is a parity contract, so
  `assert response.json()["title"] == ...` alone is too weak for the primary case.
- Assert status codes literally: 200, 202 (commands), 204 (device update/delete, recipe delete),
  400, 404, 409
- Repeated query params use a list of tuples: `params=[("tag", "breakfast"), ("tag", "sweet")]`
- Verify a mutation by reading it back through the API, not by querying the database

## Seeding

Seed through the repository inside a `transaction()`, in a fixture, and return the id:

```python
@pytest.fixture
def seeded_device_id() -> int:
    device = Device(ieee_address="00:11:22:33:44:55", friendly_name="Living Room Sensor",
                    type=DeviceType.SENSOR.value, available=True)
    with transaction() as session:
        device_repository.save(device, session)
        session.flush()
        return device.id
```

Recipes are seeded through the API instead — `create_recipe(client, VALID_RECIPE)` posts a
module-level `VALID_RECIPE` dict, and `recipe(**overrides)` deep-copies it for variants. There
are no builder classes; a dict plus `copy.deepcopy` is the pattern.

## Faking the edges

Only the outbound integrations are faked, always with `monkeypatch`, never `unittest.mock`.

**MQTT publishing** — capture what would have been sent:

```python
@pytest.fixture
def published(monkeypatch) -> list[tuple[str, bytes]]:
    sent: list[tuple[str, bytes]] = []
    monkeypatch.setattr(
        "app.mqtt.publisher.mqtt_publisher.publish",
        lambda topic, payload, qos=1, retain=False: sent.append((topic, payload)),
    )
    return sent
```

Assert the exact bytes where the wire format matters:

```python
assert published == [("zigbee2mqtt/Living Room Sensor/set",
                      json.dumps({"state": "ON"}, separators=(",", ":")).encode())]
```

**InfluxDB writes** — patch the service method:

```python
monkeypatch.setattr(telemetry_service, "write_telemetry",
                    lambda device, measurement, fields: calls.append((device, measurement, fields)))
```

**InfluxDB queries** — hand-written `FakeTable` / `FakeRecord` classes in `test_telemetry_api.py`
implementing `get_time()`, `get_value()`, `get_field()` and a `records` list. This is the
equivalent of Quarkus' `@InjectMock TelemetryService`. Keep them local to that module.

**Automation commands** — patch `device_command_service.set_state` and collect `(name, state)`.

Patching a module-level singleton's attribute is the substitution mechanism throughout, because
there is no DI container in which to swap a bean.

## MQTT, scheduler and settings

`conftest.py` sets, before any app import:

```python
os.environ.setdefault("MQTT_ENABLED", "false")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
```

The Quarkus test profile switched the same channels to the in-memory connector for the same
reason. A new external integration should get the same kind of switch rather than a test-only
code path.

Settings are `@lru_cache`d — after changing an environment variable or mutating
`get_settings().automation.*`, call `get_settings.cache_clear()` (or restore the previous value
within the same test).

## Consumers and rules

Consumers are called directly; there is no broker in the loop:

```python
consumers.consume_devices("zigbee2mqtt/bridge/devices", json.dumps(DISCOVERY_PAYLOAD).encode())
devices = {d.ieee_address: d for d in _devices()}
```

The rule engine is exercised with local `Rule` subclasses defined at module top —
`RecordingRule`, `FailingRule`, `DisabledRule`, `ScheduleOnlyRule`, `SampleThresholdRule` — fed
through a `RuleRegistry` built by a `registry_with(*rules)` helper. `fire()` temporarily swaps
`app.automation.engine.rule_registry` and restores it in a `finally`. Reuse those helpers rather
than adding a parallel mechanism.

`test_registry_discovers_rules_sorted_by_name` pins the real registry contents and their order —
a new rule must be added there too.

## Parametrisation

`@pytest.mark.parametrize` is the default for table-shaped cases and is used heavily:

- `test_z2m_mapper.py` — description → `DeviceType` across nine descriptions
- `test_telemetry_api.py` — eight invalid query-param combinations that must all return 400
- `test_datetimes.py` — microseconds → expected `OffsetDateTime` / `Instant` rendering
- `test_telemetry_service.py` — blank values that must raise from `sanitize`

Prefer one parametrised test over five near-identical ones.

## What is deliberately not tested

- paho-mqtt itself (no Mosquitto container)
- The InfluxDB client (no Influx container)
- `/q/health`, which the frontend does not consume
- Quarkus framework-supplied health checks, which have no Python equivalent

# Frontend tests (Vitest)

> Vitest + Testing Library in `frontend/`. Tests sit **next to the code they test**
> (`src/modules/devices/api/devices.test.ts`), not in a mirrored `__tests__/` tree.

## Running

```bash
cd frontend
npm test                  # vitest run — single pass, what CI runs
npx vitest                # watch mode during development
npx vitest devices        # by file-name substring
npm run lint              # oxlint
npm run build             # tsc -b && vite build — type errors fail here, not in vitest
```

`npm test` is `vitest run`, so it exits rather than watching. There is no coverage gate.

## Configuration

There is no `vitest.config.ts` — the `test` block lives in `vite.config.ts`, which imports
`defineConfig` from `vitest/config` rather than `vite`:

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
}
```

`src/test-setup.ts` is three lines and does exactly two things — pull in
`@testing-library/jest-dom/vitest` matchers, and `afterEach(cleanup)`. Keep it that way; global
fixtures belong in the test file that needs them.

The `@/` alias (`resolve.alias` → `./src`) works in tests too. Import shared modules as
`@/api/client`, and the module under test by relative path (`./devices`) — that is the existing
split.

## What is tested

Pure logic and the API-client boundary, plus component behaviour where it is not trivial.

| Kind             | Example                                     |
| ---------------- | ------------------------------------------- |
| API clients      | `modules/devices/api/devices.test.ts`       |
| Pure functions   | `modules/recipes/lib/portionScaling.test.ts` |
| Components       | `modules/devices/components/DeviceCard.test.tsx` |
| Hooks            | `modules/recipes/cook/hooks/useCountdownTimer.test.ts` |

`describe` + `it` with explicit imports from `vitest` — nothing is injected as a global, so
`import { describe, expect, it, vi } from 'vitest'` appears at the top of every file.

## Faking the edges

Same posture as the backend: only the outbound edge is faked. For the frontend that edge is
`fetch`, and the tool is `vi.stubGlobal` — not a mocked `apiFetch`, and not MSW.

```ts
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('getDevices returns the parsed device list', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(devices), { status: 200 }))

  const result = await getDevices()

  expect(fetch).toHaveBeenCalledWith('/api/devices', expect.any(Object))
  expect(result).toEqual(devices)
})
```

- Stub with a real `Response`, so status handling in `api/client.ts` is genuinely exercised
- Assert the **called URL**, not just the return value — the `/api` prefix is added inside
  `apiFetch` and a wrong path is the failure this catches
- Assert `ApiError` on non-2xx (`rejects.toBeInstanceOf(ApiError)`), and remember that 202 and
  204 resolve to `undefined` by design
- Payloads are camelCase, matching the backend wire format — a test asserting snake_case is
  asserting the wrong contract

`vi.useFakeTimers()` is the mechanism for timer hooks (`useCountdownTimer`, `StepTimer`); pair
it with `vi.useRealTimers()` in cleanup.

## Component tests

`render` from `@testing-library/react`, queried by role and accessible name rather than by class
or test id. `afterEach(cleanup)` is already global, so tests do not unmount by hand.

Components using `<Link>`/`useRoutes` need a router wrapper (`MemoryRouter`) — that is a per-test
concern, not something to hoist into `test-setup.ts`.

Do not assert on Tailwind class strings as a proxy for appearance. Class names are an
implementation detail of the token system; visual review is `ux-reviewer`'s job and
`frontend-conventions.md`'s checklist, not Vitest's.

## CI

`deploy.yml` (pushes to `main`) gates on **both** suites; `python-ci.yml` (pull requests only)
runs pytest.

The backend job starts a throwaway `postgres:17` on a dedicated Docker network, builds the
image's `test` stage, and runs `pytest -q` with the checkout mounted over `/app` — the runtime
image ships without `tests/`. Building the `test` stage doubles as a Dockerfile check.

The frontend job runs `npm ci` then `npm test`; `npm run build` runs as part of the image build,
so type errors surface there.

`deploy.yml` and `python-ci.yml` must never fire on the same event; `deploy.yml` already gates on
the suite, so a push-triggered CI run would only duplicate it.
