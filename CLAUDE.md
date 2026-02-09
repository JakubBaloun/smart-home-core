# Smart Home Core

IoT smart home platform running on Raspberry Pi 5, built with Quarkus (reactive stack) and deployed via Docker Compose. Controls Zigbee devices through Zigbee2MQTT and MQTT.

## Tech Stack

- **Language:** Java 25 (runtime eclipse-temurin:25-jre-alpine;
- **Framework:** Quarkus 3.30.x (reactive)
- **Build:** Maven (use `./mvnw`, not system `mvn`)
- **Database:** PostgreSQL 17 (reactive client + JDBC for Flyway)
- **ORM:** Hibernate Reactive with Panache
- **Messaging:** MQTT via Eclipse Mosquitto 2
- **Zigbee:** Zigbee2MQTT (Sonoff Zigbee 3.0 USB Dongle Plus V2)
- **Testing:** JUnit 5, REST Assured
- **Deployment:** Docker Compose on self-hosted GitHub Actions runner (Pi 5)

## Project Structure

```
src/main/java/org/acme/       # Application code
  model/                       # Entities (Panache)
src/main/resources/
  application.yaml             # Config (YAML, not .properties)
  db/migration/                # Flyway migrations (V{major}.{minor}.{patch}__Description.sql)
src/test/java/org/acme/        # Tests (*Test.java = unit, *IT.java = integration)
docker-compose.yaml            # All services: app, postgres, mosquitto, zigbee2mqtt
Dockerfile                     # Production image (fast-jar layout)
```

## Common Commands

```bash
# Build & test
./mvnw clean package                    # Build + run unit tests
./mvnw test                             # Unit tests only
./mvnw verify -DskipITs=false           # Unit + integration tests
./mvnw quarkus:dev                      # Dev mode with hot reload

# Single test class
./mvnw test -Dtest=GreetingResourceTest

# Docker
docker build -t smart-home-app:latest .
docker compose up -d                    # Start all services
docker compose down                     # Stop all services
docker compose logs -f smart-home-app   # App logs
```

## Architecture & Conventions

### Code Style
- **Package:** `org.acme` (base package)
- **REST endpoints:** `*Resource` classes with Jakarta REST annotations (`@Path`, `@GET`, `@POST`, etc.)
- **Entities:** Panache entities in `model/` package, extend `PanacheEntity`
- **JSON:** Jackson (via `quarkus-rest-jackson`)
- **Reactive:** Use Mutiny types (`Uni<T>`, `Multi<T>`) for reactive endpoints
- **No Lombok, no MapStruct** -- keep it simple with Panache reducing boilerplate

### Naming
- Classes: `PascalCase` (e.g., `DeviceResource`, `SensorReading`)
- Methods: `camelCase`
- REST paths: lowercase kebab-case (`/sensor-readings`)
- Flyway migrations: `V{version}__{Description}.sql` (double underscore)

### Testing
- Unit tests: `@QuarkusTest` annotation, file named `*Test.java`
- Integration tests: `@QuarkusIntegrationTest`, file named `*IT.java` (extends the unit test)
- Use REST Assured's `given()/when()/then()` fluent API for endpoint tests
- Integration tests are skipped by default (`skipITs=true`), run with `-DskipITs=false`

### Database
- All schema changes via Flyway migrations in `src/main/resources/db/migration/`
- Flyway runs at startup (`migrate-at-start: true`)
- Two datasource connections: JDBC (for Flyway) + Reactive (for Hibernate Reactive)
- Environment variables for credentials: `DB_USERNAME`, `DB_PASSWORD`, `DB_JDBC_URL`, `DB_REACTIVE_URL`

### Configuration
- YAML format (`application.yaml`), not `.properties`
- Environment variable substitution: `${VAR_NAME}`
- Quarkus profiles: `%dev`, `%test`, `%prod` prefixes in YAML for per-environment config

### Docker & Deployment
- Production Dockerfile uses Quarkus fast-jar layout (not uber-jar)
- `.dockerignore` whitelists only `target/quarkus-app/**`
- Deploy pipeline: `mvn clean package` -> `docker build` -> `docker compose up -d`
- Self-hosted runner on Pi 5 -- no staging, deploys directly to production
- Mosquitto/Zigbee2MQTT bind-mount dirs into workspace -- cleanup step needed before checkout

## Important Notes

- This is a reactive stack: prefer `Uni<T>`/`Multi<T>` return types over blocking calls
- Panache reactive entities use `PanacheEntity` -- don't create separate repository classes unless needed
- The app runs alongside MQTT broker and Zigbee2MQTT in Docker Compose -- MQTT integration is infrastructure-ready but not yet wired into the application code
- Quarkus dev mode (`./mvnw quarkus:dev`) requires a running PostgreSQL -- use `docker compose up -d smart-home-db` to start just the DB
