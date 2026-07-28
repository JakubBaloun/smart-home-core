# Smart Home Core - Claude Code Context

## Critical Rules

- **ONLY commit and push when explicitly asked** - Do not commit unless user requests

## Project Overview

IoT smart home platform running on Raspberry Pi 5, built with Quarkus (reactive stack) and deployed via Docker Compose. Controls Zigbee devices through Zigbee2MQTT and MQTT.

**Main documentation:** See `/CLAUDE.md` in root for full project context, tech stack, and conventions.

## Preferred Approach: Research → Plan → Execute → Explain

1. **Research** - Analyze existing code before proposing solutions
2. **Plan** - Create architectural plan, present for approval (use Plan Mode)
3. **Execute** - Implement systematically, mark todos complete immediately
4. **Explain** - Document decisions, help communicate to stakeholders

## Quick Reference

### Tech Stack Summary

- **Language:** Java 25 with Quarkus 3.30.x (reactive)
- **Database:** PostgreSQL 17 (Hibernate Reactive + Panache)
- **Messaging:** MQTT (Mosquitto + Zigbee2MQTT)
- **Testing:** JUnit 5, REST Assured
- **Build:** Maven wrapper (`./mvnw`)

### Common Commands

```bash
./mvnw clean package                    # Build + run unit tests
./mvnw verify -DskipITs=false           # Unit + integration tests
./mvnw quarkus:dev                      # Dev mode with hot reload
docker compose up -d                    # Start all services
```

### Configuration

- **YAML only** - Never `.properties` files
- `application.yaml` - Main config (with `%dev`, `%test`, `%prod` profiles)
- Flyway migrations: `src/main/resources/db/migration/V{version}__{Description}.sql`

### Architecture Pattern

- **Feature-based packages:** `device/`, `telemetry/`, `automation/`, `mqtt/`
- **Layered within features:** `Entity.java` → `repository/` → `service/` → `resource/`
- **Reactive first:** Use `Uni<T>`/`Multi<T>` return types
- **Custom repositories:** Hibernate Reactive `Session`, not Panache active-record

## Detailed Specifications

For comprehensive patterns and standards, see `.claude/specs/`:

| Spec                   | Contents                              |
| ---------------------- | ------------------------------------- |
| `coding-standards.md`  | Java style, imports, JavaDoc, Flyway  |
| `reactive-patterns.md` | Mutiny patterns, reactive composition |
| `mqtt-patterns.md`     | MQTT integration, Zigbee2MQTT         |
| `testing-patterns.md`  | Unit/integration tests, REST Assured  |
| `git-workflow.md`      | Commit format, PR rules               |

## Critical Patterns (Quick Reference)

### Reactive Patterns

- Return `Uni<T>` for single values, `Multi<T>` for streams
- Use `.chain()` for sequential operations
- Use `.invoke()` for side effects (logging)
- Never block reactive chains

### Repository Pattern

- Custom `@ApplicationScoped` repositories
- Inject Hibernate Reactive `Session`
- Use `session.find()`, `session.persist()`, `session.createQuery()`
- Return `Uni<T>` or `Multi<T>`

### Testing Pattern

- Unit test: `@QuarkusTest`, name `*Test.java`
- Integration test: `@QuarkusIntegrationTest`, name `*IT.java`
- Use REST Assured: `given().when().then()` style
- Integration tests skipped by default (`-DskipITs=false` to run)

### Database Pattern

- Entities extend `PanacheEntityBase` with explicit `Long id`
- All schema changes via Flyway migrations
- Two datasource configs: JDBC (Flyway) + Reactive (Hibernate)
- Never modify schema directly

## Important Files

- `CLAUDE.md` - Full project documentation (root level)
- `docker-compose.yaml` - All services definition
- `src/main/resources/application.yaml` - Main configuration
- `src/main/resources/db/migration/` - Database migrations
