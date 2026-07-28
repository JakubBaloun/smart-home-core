# smart-home-core

IoT smart home platform for a Raspberry Pi 5. A Quarkus (reactive) backend and a React frontend
control Zigbee devices through Zigbee2MQTT and MQTT, store the device registry in PostgreSQL,
and write sensor telemetry to InfluxDB.

## Repository layout

```
backend/    Quarkus application (Java 25, Maven)
frontend/   React + Vite dashboard (served by nginx in production)
infra/      Infrastructure config (mosquitto)
bruno/      Bruno API collection for the REST API
docker-compose.yaml       Production stack (runs on the Pi)
docker-compose.dev.yaml   Local dev infrastructure (postgres, influxdb, mosquitto)
```

## Architecture

```
Zigbee devices ── Zigbee2MQTT ── Mosquitto (MQTT) ── backend ──┬── PostgreSQL (device registry)
                                                               └── InfluxDB   (telemetry)
frontend (nginx) ── /api/* ──> backend REST API
```

- **Device discovery:** Z2M publishes the retained device list on `zigbee2mqtt/bridge/devices`;
  the backend syncs it into PostgreSQL.
- **Telemetry:** per-device state on `zigbee2mqtt/<friendly_name>` is written to InfluxDB
  (numeric fields are coerced to double to avoid Influx field-type conflicts).
- **Availability:** `zigbee2mqtt/<friendly_name>/availability` updates device availability.
  This requires the Zigbee2MQTT [availability feature](https://www.zigbee2mqtt.io/guide/configuration/device-availability.html)
  to be enabled; without it devices keep the availability from the last device-list sync.
- **Bridge state:** `zigbee2mqtt/bridge/state` feeds a readiness health check (`/q/health`).
- **Commands:** `POST /api/devices/{id}/command` publishes to `zigbee2mqtt/<friendly_name>/set`.
- **Automation rules:** Java rules configured via `application.yaml` (`automation.*`):
  `night-mode`, `door-opened-lights`, `temperature-alert`.

## Local development

Start the local infrastructure (PostgreSQL on host port **5433**, InfluxDB on 8086, Mosquitto on 1883):

```bash
docker compose -f docker-compose.dev.yaml up -d
```

Run the backend in dev mode (hot reload, sensible localhost defaults — no env vars needed):

```bash
cd backend && ./mvnw quarkus:dev
```

Run the frontend dev server (proxies `/api` to `localhost:8080`):

```bash
cd frontend && npm install && npm run dev
```

Simulate Zigbee2MQTT with the mosquitto container:

```bash
# Publish a fake device list (retained, as Z2M does)
docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/bridge/devices -r \
  -m '[{"ieee_address":"0x01","friendly_name":"temp","type":"EndDevice","definition":{"description":"Temperature and humidity sensor","model":"WSDCGQ11LM","vendor":"Aqara"}}]'

# Publish telemetry
docker exec mqtt-broker-dev mosquitto_pub -t zigbee2mqtt/temp -m '{"temperature":25.5,"humidity":40}'

# Watch everything on the bus
docker exec mqtt-broker-dev mosquitto_sub -v -t 'zigbee2mqtt/#'
```

## Build & test

```bash
cd backend && ./mvnw clean package          # backend build + unit tests
cd backend && ./mvnw verify -DskipITs=false # incl. integration tests
cd frontend && npm test && npm run build    # frontend tests + production build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml` on a self-hosted runner on the Pi:
backend and frontend are built and tested, Docker images are built from `backend/` and
`frontend/`, and `docker compose up -d` restarts the production stack. There is no staging
environment — a push to `main` goes straight to production.

Production configuration (database credentials, Influx token, etc.) comes from
`/home/jakub/.env` on the Pi, referenced by `docker-compose.yaml`.

### Note: existing InfluxDB data after the telemetry-type fix

Telemetry fields are now always written as floats. If the production bucket already contains
integer-typed fields from before the fix, writes will keep failing with a field-type conflict
until the current shard rolls over. Since only single stray points exist, the simplest fix is
to clear the bucket once after deploying:

```bash
docker exec influxdb influx delete --bucket telemetry --org smart-home \
  --start 1970-01-01T00:00:00Z --stop $(date -u +%Y-%m-%dT%H:%M:%SZ)
```
