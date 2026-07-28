# Smart Home Core

IoT smart home platform running on Raspberry Pi 5. Monorepo: Quarkus (reactive) backend +
React frontend, deployed via Docker Compose. Controls Zigbee devices through Zigbee2MQTT and
MQTT; device registry in PostgreSQL, telemetry in InfluxDB.

## Tech Stack

- **Backend:** Java 25, Quarkus 3.30.x (reactive), Maven (use `./mvnw` in `backend/`)
- **Frontend:** React 19 + TypeScript + Vite, Recharts, Vitest (in `frontend/`)
- **Device registry:** PostgreSQL 17 — Hibernate Reactive + Panache (reactive client + JDBC for Flyway)
- **Telemetry:** InfluxDB 2.x (`influxdb-client-java`)
- **Messaging:** MQTT via Eclipse Mosquitto 2 + SmallRye Reactive Messaging
- **Zigbee:** Zigbee2MQTT (Sonoff Zigbee 3.0 USB Dongle Plus V2)
- **Testing:** JUnit 5, Mockito, REST Assured (backend); Vitest + Testing Library (frontend)
- **Deployment:** Docker Compose on self-hosted GitHub Actions runner (Pi 5)

## Repository Layout

```
backend/                          # Quarkus application
  src/main/java/io/smarthome/core/   # Base package (feature-based)
    common/exception/             # Global exception mappers, ErrorResponse
    device/                       # Device entity, repository/, service/, resource/
      service/mapper/             # Z2MDeviceMapper (Z2M payload -> entity)
      resource/                   # REST layer, DTOs, entity<->DTO mapper
    telemetry/                    # InfluxDB write/query pipeline + REST
    automation/                   # Rule engine (Rule, RuleRegistry, RuleEngine, rule/)
    mqtt/                         # SmallRye MQTT consumers (discovery, telemetry,
                                  #   availability, bridge state) + health check
    config/                       # InfluxDB client producer
  src/main/resources/
    application.yaml              # Config incl. %dev profile and automation rules
    db/migration/                 # Flyway migrations (V{x.y.z}__Description.sql)
  src/test/java/...               # Tests mirror main (*Test.java unit, *IT.java integration)
frontend/                         # React dashboard (nginx serves it in prod, proxies /api)
infra/mosquitto/mosquitto.conf    # Broker config (mounted by both compose files)
bruno/                            # Bruno API collection
docker-compose.yaml               # Production stack (app, frontend, postgres, influxdb,
                                  #   mosquitto, zigbee2mqtt) — env from /home/jakub/.env on the Pi
docker-compose.dev.yaml           # Local dev infra: postgres (host port 5433!), influxdb, mosquitto
.github/workflows/deploy.yml      # CI: build/test both apps, docker compose up on the Pi
```

## Common Commands

```bash
# Backend (run inside backend/)
./mvnw clean package                    # Build + unit tests
./mvnw test -Dtest=DeviceServiceTest    # Single test class
./mvnw verify -DskipITs=false           # Unit + integration tests
./mvnw quarkus:dev                      # Dev mode (hot reload), needs docker-compose.dev.yaml up

# Frontend (run inside frontend/)
npm run dev                             # Vite dev server (proxies /api to localhost:8080)
npm test                                # Vitest
npm run build                           # Production build

# Local infrastructure (repo root)
docker compose -f docker-compose.dev.yaml up -d   # postgres:5433, influxdb:8086, mosquitto:1883

# Simulating Zigbee2MQTT locally
docker exec mqtt-broker-dev mosquitto_sub -v -t 'zigbee2mqtt/#'
docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/temp -m '{"temperature":25.5}'
```

## Architecture & Conventions

### MQTT topics (Zigbee2MQTT contract)

- `zigbee2mqtt/bridge/devices` (retained) → device discovery/sync into PostgreSQL
- `zigbee2mqtt/bridge/state` → BridgeStateHolder + readiness health check (`/q/health`)
- `zigbee2mqtt/<friendly_name>` → telemetry into InfluxDB
- `zigbee2mqtt/<friendly_name>/availability` → device availability (needs Z2M availability feature)
- `zigbee2mqtt/<friendly_name>/set` ← outgoing commands (topic set per message via
  `SendingMqttMessageMetadata` on the `z2m-command` channel)

### Critical invariants

- **Telemetry fields are always written to InfluxDB as double** (booleans stay boolean,
  strings are skipped). InfluxDB fixes a field's type on first write per shard; mixed
  int/float writes are silently rejected otherwise. Do not remove the coercion in
  `TelemetryService.normalizeFields`.
- **Availability is owned by the availability topic**, not by device sync:
  `Z2MDeviceMapper.updateEntityFromPayload` must not touch `available`/`lastSeen`.
- **Automation rules must stay reachable by CDI:** `RuleRegistry` injects `@Any Instance<Rule>`
  so ArC does not remove rule beans as unused. New rules: implement `Rule`, annotate
  `@ApplicationScoped` + `@AutomationRule(name = ...)`, add config under `automation.` in
  `application.yaml` (see `AutomationConfig`).

### Code style

- Base package `io.smarthome.core`, feature-based packages, layered within features
  (`Entity` → `repository/` → `service/` → `resource/`)
- Reactive first: Mutiny `Uni<T>`/`Multi<T>`, never block; `.chain()` for sequencing,
  `.invoke()` for side effects
- Custom `@ApplicationScoped` repositories using Hibernate Reactive `Session` (not
  Panache active-record)
- MapStruct with `componentModel = "jakarta-cdi"`; Lombok for boilerplate;
  logging via `io.quarkus.logging.Log` (read paths at debug, mutations/events at info)
- REST: `*Resource` classes, kebab-case paths, Jackson JSON

### Configuration

- YAML only (`application.yaml`), env-var substitution `${VAR:default}`
- `%dev` profile has localhost defaults matching `docker-compose.dev.yaml`
  (postgres on **5433**, influx token `dev-token`) — `quarkus:dev` needs no exported vars
- Automation rules configured under `automation.` (type-safe `AutomationConfig`
  `@ConfigMapping`); device names are Zigbee2MQTT friendly names
- Production env vars come from `/home/jakub/.env` on the Pi (not in repo):
  `DB_*`, `INFLUXDB_*`, `MQTT_*`

### Database

- All schema changes via Flyway migrations in `backend/src/main/resources/db/migration/`
- Two datasource connections: JDBC (Flyway) + reactive (Hibernate Reactive)

### Testing

- Unit: `@QuarkusTest`, `*Test.java`; integration: `@QuarkusIntegrationTest`, `*IT.java`
  (skipped by default, `-DskipITs=false` to run)
- MQTT channels are switched to the in-memory connector in `backend/src/test/resources/application.yaml`
  — new channels must be added there too, or tests will try to connect to a real broker
- REST tests use REST Assured `given()/when()/then()`

### Deployment

- Push to `main` = production deploy (self-hosted runner on the Pi, no staging).
  **Never commit or push unless explicitly asked.**
- Prod images: `backend/Dockerfile` (fast-jar), `frontend/Dockerfile` (nginx)
- Mosquitto/Zigbee2MQTT bind-mount dirs on the Pi — the workflow's cleanup step must run
  before checkout
