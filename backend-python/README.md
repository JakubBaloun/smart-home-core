# backend-python

A Python/FastAPI port of the Quarkus backend in `../backend`. It started as a
**faithful rewrite, not a redesign**: same REST API, same MQTT behaviour, same
automation rules, same data model. The Quarkus code is the specification —
wherever the two could differ, this port follows what Quarkus actually does,
including quirks.

That parity rule now has **one deliberate exception**: telemetry identity. See
"Telemetry is keyed by ieee_address" below for what diverges and why. Quarkus is
no longer the spec for that area.

This backend now **serves production**. `docker-compose.yaml` runs it as
`smart-home-app` and nginx proxies `/api` to it. The Quarkus source in
`../backend` is untouched and still builds, but it is no longer deployed — it
remains as the reference spec and as the home of the Flyway migrations.

## Layout

```
app/
  config.py            # pydantic-settings equivalent of application.yaml
  db.py                # SQLAlchemy engine, session helpers, schema verification
  main.py              # FastAPI app, lifespan wiring, uvicorn entrypoint
  common/              # exceptions, exception handlers, pagination, event bus,
                       #   Jackson-compatible datetime serializers
  device/              # models, schemas, repository, service, router,
                       #   command_service, z2m_mapper, mappers
  telemetry/           # influx client, service, schemas, router, fields, events
  recipe/              # models, schemas, repository, service, routers
  mqtt/                # paho client, consumers, publisher, bridge state, health
  automation/          # rule base, rules/, registry, engine, bridge, scheduler
schema.sql             # verbatim snapshot of the Flyway schema (test bootstrap only)
tests/                 # pytest mirror of the Quarkus test classes
```

Module boundaries and layering mirror `io.smarthome.core.*` one-to-one, so a
Quarkus class and its Python counterpart are always in the matching place.

## Running locally

It listens on **8081** (`HTTP_PORT`) and connects to MQTT as **`smart-home-py`**
(one connection, where Quarkus opened five). Those values differ from Quarkus so
that a local Quarkus instance can still be started next to it for comparison.

Start the dev infrastructure from the repo root first:

```bash
docker compose -f docker-compose.dev.yaml up -d   # postgres:5433, influxdb:8086, mosquitto:1883
```

Then run the app. The defaults in `app/config.py` match the Quarkus `%dev`
profile, so no exported variables are needed locally:

```bash
cd backend-python
pip install -e ".[test]"
python -m app.main            # http://localhost:8081
```

Or in Docker (needed if your system Python is older than 3.11):

```bash
docker build -t smart-home-py .
docker run --rm -p 8081:8081 \
  -e DB_HOST=host.docker.internal -e DB_PORT=5433 \
  -e INFLUXDB_URL=http://host.docker.internal:8086 -e INFLUXDB_ORG=smart-home \
  -e MQTT_HOST=host.docker.internal \
  smart-home-py
```

Environment variable names are the same as Quarkus (`DB_*`, `INFLUXDB_*`,
`MQTT_*`) plus a few Python-only switches: `HTTP_PORT`, `MQTT_ENABLED`,
`SCHEDULER_ENABLED`, `SCHEMA_CHECK_ENABLED`, `MQTT_CLIENT_ID`, `DB_URL`.

### Pointing the frontend at it

`frontend/vite.config.ts` proxies `/api` to `localhost:8081`, so `npm run dev`
talks to this backend with no further setup. In production nginx proxies `/api`
to `smart-home-app:8081`. The frontend itself is unmodified — the port change is
the only frontend-side difference between the two backends.

## Production deployment

`docker-compose.yaml` runs this backend as `smart-home-app`. The container name
is unchanged from the Quarkus era so nginx and dozzle references still resolve.

The one piece that did not come across is schema migration. Quarkus ran Flyway
in-process (`QUARKUS_FLYWAY_MIGRATE_AT_START`), and this backend deliberately
does not own the schema (see below), so compose gained a one-shot
`smart-home-flyway` service. It mounts `backend/src/main/resources/db/migration`,
waits for a new `smart-home-db` healthcheck, and the app waits for it with
`condition: service_completed_successfully`.

That leaves `docker-compose.yaml` depending on the Quarkus source tree for its
migrations. If `backend/` is ever removed, move `db/migration/` to the repo root
first.

Deployment happens on push to `main` via `.github/workflows/deploy.yml`, which
gates on the pytest suite and the frontend tests before `docker compose up -d`.
It no longer builds or tests `backend/`.

## Database strategy

**No Alembic. Flyway stays the single owner of the schema.**

Two backends generating migrations against one database is the fastest way to
corrupt it, and the schema is not changing as part of this port. Instead:

- SQLAlchemy models are hand-written to match the existing tables. On startup
  `main.verify_schema()` reflects the database and fails fast if an expected
  table is missing, so pointing this backend at an unmigrated database is an
  immediate error rather than a confusing failure at the first query. Set
  `SCHEMA_CHECK_ENABLED=false` to skip it.
- `schema.sql` is a verbatim snapshot of the Flyway result. It is used **only**
  to bootstrap throwaway databases for tests and parity runs. It is not a
  migration mechanism.

If the schema ever changes, add the Flyway migration in `backend/` as usual and
re-snapshot `schema.sql`. That has happened once:
`V1.3.0__Create_Device_Alias_Table.sql`, added for the telemetry identity work
below. It is additive (one new table plus a seed from `device`) and touches no
existing column or row. The production compose file mounts the whole migration
directory, so it applies on the next deploy with no compose change.

**Never run both backends against the same infrastructure for longer than a
parity check.** They subscribe to the same topics, so device rows race on
`updatedAt`, every telemetry point lands in InfluxDB **twice**, and — worst —
automation rules fire twice, publishing two commands to
`zigbee2mqtt/<name>/set`. The parity runs used a separate database and bucket
for exactly this reason.

## Tests

```bash
pytest                                    # spins up postgres via testcontainers
TEST_DB_URL=postgresql+psycopg://smarthome:smarthome@localhost:5433/smarthome_py_test pytest
```

`TEST_DB_URL` skips testcontainers and uses an existing database — required when
running the suite inside the Docker image (Docker-in-Docker is not available
there):

```bash
docker run --rm -v "$PWD:/app" \
  -e TEST_DB_URL='postgresql+psycopg://smarthome:smarthome@host.docker.internal:5433/smarthome_py_test' \
  smart-home-py python -m pytest -q
```

The suite drops and recreates the `public` schema from `schema.sql` once per
run, truncates between tests, and never mocks the database. 137 tests currently
pass: `tests/test_device_identity.py` covers the rename/telemetry-identity
behaviour, and the rest cover every Quarkus test class that has a behavioural
equivalent
(`RecipeResourceTest`, `DeviceResourceTest`, `CommandResourceTest`,
`TelemetryResourceTest`, `TelemetryServiceTest`, `DeviceRepositoryTest`,
`DeviceCommandServiceTest`, `Z2MDeviceMapperTest`, the MQTT consumer tests, and
the automation rule/engine tests).

## CI

Two workflows, and they must not both fire on the same event:

- `python-ci.yml` — **pull requests only** (plus `workflow_dispatch`), filtered
  to `backend-python/`.
- `deploy.yml` — pushes to `main`. It runs the same suite as the gate before
  deploying, so a separate push-triggered CI run would only duplicate it.

Both start a throwaway `postgres:17` on their own Docker network, build the
image's `test` stage (which doubles as a Dockerfile check), and run pytest with
the checkout mounted over `/app` — the runtime image ships without `tests/`.

## Parity verification

`/tmp/parity.sh` (not committed) fires ~30 identical requests at both backends
and diffs status code plus normalised JSON body. Everything matches except one
documented item (see "Set.of ordering" below). Additionally verified live
against both backends on the same infrastructure:

- device list / detail — byte-identical, including all three timestamps
- recipe CRUD, search by ingredient, `tag=` repetition, pagination clamping
- telemetry latest, raw history, and windowed aggregation — byte-identical
- all validation 400 bodies, including Hibernate Validator's
  `createRecipe.request.steps[0].timerSeconds` field paths
- 404 semantics, including path-param conversion failures
- device command MQTT payloads: both publish exactly `{"state":"ON"}`,
  `{"brightness":200}`, `{"color_temp":370}`, `{"effect":"blink"}` to
  `zigbee2mqtt/<name>/set`
- command error cases: unknown command, blank command, missing payload keys

## Telemetry is keyed by ieee_address (deliberate divergence from Quarkus)

**The bug.** Rename a thermometer in the web app and its charts go blank. In the
Quarkus design `friendly_name` did two incompatible jobs at once: user-facing
label, and primary key for telemetry. The telemetry consumer took the device
name straight out of the topic (`zigbee2mqtt/<friendly_name>`, prefix stripped,
no lookup) and wrote it to InfluxDB as the `device_id` tag; the frontend then
asked for charts using the device's *current* name from Postgres. Renaming only
wrote the new name to the `friendly_name` column and told Zigbee2MQTT nothing —
so Z2M kept publishing under the old name, all history stayed under the old
name, and the frontend asked for a name nothing was ever filed under.

**The split.** `ieee_address` is the device's immutable hardware identity and is
now the InfluxDB `device_id` tag. `friendly_name` is a label. The new
`device_alias` table records every name a device has ever been published under,
which is what makes the two ends meet.

### The three decisions worth arguing about

**1. A rename now asks Zigbee2MQTT to rename too — but nothing depends on it
succeeding.** Tagging by `ieee_address` means the consumer needs a topic-name →
device lookup, and a lookup that can fail is a lookup that can silently stop all
telemetry. So `PUT /api/devices/{id}` publishes to
`zigbee2mqtt/bridge/request/device/rename` and listens on
`.../response/device/rename`. Crucially that publish is **best effort, outside
the transaction, and never fails the request**: the old name stays in
`device_alias`, so the inbound resolver (ieee → current name → any former name)
still resolves the old topic even if Z2M is offline, rejects the rename, or is
never told. Telemetry and availability keep flowing either way; the rename
request is an optimisation that keeps the topic tidy, not a correctness
requirement. Verified live with no Z2M running at all.

**2. Existing history is unioned on read, never rewritten.** Everything already
in InfluxDB is tagged with the friendly name of the day. Switching the tag
without more would relocate the bug rather than fix it, so the *query* side asks
for all of a device's identities at once —
`r.device_id == "<ieee>" or r.device_id == "<name>" or ...` — built from
`DeviceIdentity.telemetry_keys`. The Flyway migration seeds `device_alias` with
each device's current name, which is exactly the tag its existing points carry,
so history is continuous across the cutover with **zero writes to InfluxDB**.
Two consequences fall out of the union and are handled in the router: points
arrive as one table per tag value and are re-sorted by time (Recharts plots in
array order), and `last()` returns one record per field *per tag value*, so
`/latest` picks the newest per field rather than whichever came last.

**3. Telemetry from a device that is not in Postgres is still written.**
Unchanged from Quarkus, on purpose. An unresolvable topic name is tagged with
the raw name, exactly as before, and logged once per name. Dropping it would
mean losing readings in the window between a device joining the network and the
next `bridge/devices` sync, and it would turn a transient database problem into
permanent data loss. The read path falls back the same way — an identifier that
matches no device is queried verbatim — so that data stays reachable by name,
and it heals itself once discovery registers the device.

### Other notable points

- **`z2m_mapper.update_entity_from_payload` still overwrites `friendly_name`.**
  Z2M remains the source of truth for what a device is *called on MQTT*, so a
  rename done in the Z2M UI is picked up as before. The app's rename is not
  authoritative over Z2M; it is *propagated* to Z2M, which is why the old
  "rename silently reverts on the next Z2M restart" trap no longer fires in the
  normal case. If Z2M rejects the rename, the label does revert at the next sync
  — an honest signal, logged at both ends, and harmless to data because both
  names resolve to the same device. The alternative (an app-owned `display_name`
  column that Z2M never touches) is a bigger change and is not implemented.
- **`alias` is globally unique.** A name identifies at most one device, first
  claimant wins. Without this, two devices that held the same name at different
  times would inherit each other's history.
- **Availability now resolves through the alias set** before updating, so an
  availability message on a pre-rename topic still lands on the right row.
- **Rule events still carry a name, not an ieee address** (`automation.*` config
  names devices by friendly name). The event now carries the *registry's* name
  rather than the raw topic name — identical unless the two have drifted.
- **No caching of the topic → device lookup.** It is one indexed query per
  telemetry message on a local database, and the availability consumer already
  did a write per message. A cache here would risk re-creating the exact class
  of staleness bug being fixed.
- **The frontend now requests telemetry by `ieeeAddress`** (`DeviceDetailPage`,
  `TemperatureCard`, `temperature.ts`). Friendly names still work — the router
  accepts an ieee address, the current name, or any former name — so old
  bookmarks and a stale open tab keep working.

### One-off: reattaching history for a device renamed *before* this change

The migration can only seed the name a device has *now*. If a device was renamed
under the old code, its pre-rename points sit under a name Postgres no longer
knows, and nothing can infer it. **This is a manual step, left for you to run.**

Find the orphaned tag values:

```bash
docker exec influxdb-dev influx query --org smart-home '
import "influxdata/influxdb/schema"
schema.tagValues(bucket: "telemetry", tag: "device_id")'
```

Then claim the old name for the device that owns it (additive, one row, no
telemetry is touched):

```sql
INSERT INTO device_alias (ieee_address, alias)
VALUES ('0x00124b00xxxxxxxx', '<the old name>')
ON CONFLICT DO NOTHING;
```

The charts pick it up on the next request — no restart, no InfluxDB rewrite.

## Ambiguities in the Quarkus code and how they were resolved

Written down as they came up, so a reviewer does not have to re-derive them.

**Validation error body.** Recipe/device DTOs use Bean Validation annotations,
so the 400 body is not produced by `GlobalExceptionHandler` at all — Quarkus'
built-in `ViolationReport` mapper emits
`{"title":"Constraint Violation","status":400,"violations":[{"field","message"}]}`.
The `field` is the full method-parameter path
(`createRecipe.request.steps[0].timerSeconds`), not the property name. This was
confirmed empirically against a running Quarkus instance and is reproduced in
`common/errors.py`, which rebuilds that path from the FastAPI route name and the
Pydantic error location, and strips Pydantic's `"Value error, "` prefix.
Consequence: every list-emptiness check is a `field_validator` carrying the Java
message verbatim rather than Pydantic's `min_length`, whose message differs.

**Path vs query param conversion failure.** JAX-RS turns an unparsable
`@PathParam` into **404** but an unparsable `@QueryParam` into 400. FastAPI
returns 422/400 for both, so the `RequestValidationError` handler special-cases
`loc[0] == "path"` into a bare 404.

**Datetime serialisation.** Quarkus emits two different fraction formats and the
frontend sees both: `OffsetDateTime` (device/recipe) goes through
`ISO_OFFSET_DATE_TIME`, which prints the fewest digits needed
(`17:49:58.22422Z`), while `Instant` (telemetry) goes through `ISO_INSTANT`,
which pads to a multiple of three (`17:50:00.268Z`). Pydantic would print a
fixed six digits for both. `common/datetimes.py` provides the two annotated
types; picking the wrong one produces a visible diff.

**`BigDecimal` in recipe ingredient amounts.** Jackson writes it as a JSON
number; Pydantic writes `Decimal` as a string. A `field_serializer` returning
`float` restores the Quarkus wire format.

**`Set.of` ordering (known, unfixable, cosmetic).** The telemetry validation
message `'field' must be one of: ...` iterates a Java `Set.of(...)` whose order
is salted per JVM run — three consecutive Quarkus starts produced three
different orderings. Python's order is deterministic (declaration order). The
set of allowed values is identical; only the order inside one error string
differs, and it differs between two Quarkus runs as well. Not worth emulating.

**`bool` is an `int` in Python.** Java's `instanceof Number` excludes `Boolean`,
so `TelemetryService.normalizeFields` coerces numbers to double while leaving
booleans boolean. In Python `isinstance(True, int)` is `True`, so bool must be
checked *before* the numeric branch — in `telemetry/service.py` and in
`AbstractThresholdRule`. Getting this wrong would silently write `1.0` instead
of `true` and permanently fix the InfluxDB field type.

**`KNOWN_FIELDS` location.** In Quarkus the constant lives on
`TelemetryConsumer` (MQTT layer) and `TelemetryResource` imports it. Mirroring
that literally would make the REST layer import the MQTT layer, so it moved to
`telemetry/fields.py`; both layers import it from there.

**MQTT connection topology.** Quarkus opens five SmallRye channels, hence five
client ids. paho multiplexes fine, so this port uses one connection with
`message_callback_add` per topic filter. Subscriptions keep the original QoS per
channel (`bridge/devices` qos 1 retained, `bridge/state` qos 0, `zigbee2mqtt/+`
qos 0, `+/availability` qos 1) and are re-established in `on_connect` so a
broker restart does not silently stop delivering.

**MQTT consumer failure handling.** The Quarkus channels use
`failure-strategy: ignore`, so a consumer that throws simply drops the message
and the channel survives. Java's `DeviceDiscoveryConsumer` therefore lets a
parse failure propagate. The Python consumers catch and log instead, which is
behaviourally identical at the channel level but visible in a stack trace's
absence.

**Availability ownership.** Confirmed and preserved: `Z2MDeviceMapper`
deliberately does not touch `available`/`lastSeen` on update, because the
availability topic owns those fields. Device sync overwriting them would flap
availability on every discovery message.

**Automation rule discovery.** CDI's `@Any Instance<Rule>` is replaced by an
explicit list in `automation/registry.py`, sorted by `metadata.name` for a
stable evaluation order (CDI's order is not specified). New rules are added to
that list — there is no scanning, which is the intended trade-off for a codebase
this size.

**Duplicate observer registration.** CDI registers exactly one observer per
method; the Python event bus is a plain dict of lists, so re-registering during
tests would double-fire rules. `EventBus.subscribe` is idempotent.

**Scheduler timezone.** `NightModeRule` is annotated
`@Scheduled(cron = "0 0 0 * * ?", timeZone = "Europe/Prague")`. APScheduler
defaults to the process timezone, which in the container is UTC, so the trigger
is pinned to `ZoneInfo("Europe/Prague")` explicitly — otherwise night mode would
fire one or two hours off depending on DST.

**Health endpoint.** `/q/health` reproduces the SmallRye envelope and the
`zigbee2mqtt-bridge` check byte-for-byte. It does **not** reproduce the
framework-supplied checks (SmallRye Messaging liveness/readiness/startup,
datasource checks) — those describe Quarkus internals that do not exist here.
The frontend does not consume `/q/health`, so this has no parity impact.
