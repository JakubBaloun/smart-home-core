# Coding Standards

> Java coding conventions for Smart Home Core.

## Java Import Rules - NO FULLY QUALIFIED NAMES

**NEVER** use fully qualified class names in code. **ALWAYS** add proper imports.

| Correct | Wrong |
|---------|-------|
| `import jakarta.validation.constraints.NotNull;` then `@NotNull` | `@jakarta.validation.constraints.NotNull` |
| `import jakarta.persistence.PersistenceException;` | `throw new jakarta.persistence.PersistenceException()` |

Wildcard imports acceptable: `import jakarta.ws.rs.*;`

## Formatting

- 120 char line length (standard Java convention)
- Use IntelliJ IDEA default formatting
- Wrap comments and long lines appropriately

## JavaDoc Standards - Concise & Clear

- **Concise** - Balance brevity with clarity
- **Professional language** - Clear terminology, assumes competent reader
- **Class-level**: 1-3 sentences; use `@see` for related types
- **Method-level**: 1-2 sentences; omit obvious parameters
- **Prefer `{@link}` and `@see`** over prose explanations

**Good:**
```java
/**
 * Manages Zigbee device lifecycle and state synchronization.
 *
 * @see Device - entity model
 * @see Zigbee2MqttConsumer - MQTT message handler
 */
@ApplicationScoped
public class DeviceService {

    /**
     * Registers a new device discovered via Zigbee2MQTT.
     *
     * @param ieeeAddress unique Zigbee IEEE address
     * @return persisted device entity
     */
    public Uni<Device> registerDevice(String ieeeAddress) { ... }
}
```

**Bad:**
- Multi-paragraph explanations
- Step-by-step tutorials in JavaDoc
- Redundant `@param` descriptions for self-explanatory parameters

## Configuration Files

- **ALWAYS** use YAML format (`.yaml`), **NEVER** `.properties`
- `application.yaml` - Main configuration
- Quarkus profiles: `%dev`, `%test`, `%prod` prefixes
- Applies to both `src/main/resources` and `src/test/resources`

## Database Migrations (Flyway)

- All schema changes via Flyway migrations: `V{version}__{Description}.sql`
- Version format: `V1.0.0__Description.sql` (major.minor.patch)
- Naming: Use descriptive names, e.g., `V1.1.0__Add_device_type_column.sql`
- **Always test migrations** against empty database before committing
- Migrations are **immutable** - never edit applied migrations

## Reactive Programming (Mutiny)

Use Mutiny `Uni<T>` and `Multi<T>` for all asynchronous operations.

```java
// Good: Simple delegation - no complex chain needed
public Uni<Device> getDevice(Long id) {
    return repository.findById(id);
}

// Good: Complex chain with logging and error handling
public Uni<Device> updateDevice(Long id, UpdateDeviceRequest request) {
    return repository.findById(id)
            .onItem().ifNull().failWith(() -> new DeviceNotFoundException(id))
            .invoke(device -> log.debug("Updating device: {}", device.getId()))
            .chain(device -> {
                device.setName(request.name());
                device.setRoom(request.room());
                return repository.update(device);
            })
            .invoke(device -> log.info("Device updated: {}", device.getId()))
            .onFailure().invoke(err -> log.error("Failed to update device: {}", id, err));
}

// Good: REST endpoint with validation
@PUT
@Path("/{id}")
public Uni<Response> updateDevice(@PathParam("id") Long id, UpdateDeviceRequest request) {
    if (request.name() == null || request.name().isBlank()) {
        return Uni.createFrom().item(Response.status(400).entity("Name is required").build());
    }

    return service.updateDevice(id, request)
            .map(device -> Response.ok(mapper.toResponse(device)).build())
            .onFailure(DeviceNotFoundException.class)
            .recoverWithItem(err -> Response.status(404).entity(err.getMessage()).build());
}
```

**Key principles:**
- Return `Uni<T>` for single values, `Multi<T>` for streams
- Use `.chain()` for sequential operations that return `Uni`
- Use `.invoke()` for side effects (logging, metrics)
- Never block reactive chains (no `.await()` in production code)
- Handle failures explicitly with `.onFailure()` chains

## Lombok Usage

Use Lombok to reduce boilerplate:

- `@Slf4j` - Logging field
- `@Data` - Getters, setters, toString, equals, hashCode (for DTOs)
- `@Builder` - Builder pattern (for DTOs and test fixtures)
- `@RequiredArgsConstructor` - Constructor for final fields (with CDI)
- `@NoArgsConstructor` - Default constructor (for entities, required by Hibernate)

**Avoid:**
- `@AllArgsConstructor` on entities (can break Hibernate proxies)
- `@Data` on entities (use `@Getter`/`@Setter` instead for better control)

## MapStruct for DTOs

Use MapStruct for entity-DTO mapping:

```java
@Mapper(componentModel = "jakarta-cdi")
public interface DeviceMapper {
    DeviceResponse toResponse(Device entity);
    Device toEntity(CreateDeviceRequest request);
}
```

- Set `componentModel = "jakarta-cdi"` for CDI injection
- Keep mappers simple - complex logic belongs in services
- Use `@Mapping` annotations for non-matching field names

## Package Structure

Feature-based packages with layered structure:

```
org.acme.device/
  Device.java              # Entity (model layer)
  DeviceType.java          # Enums, value objects
  repository/
    DeviceRepository.java  # Data access layer
  service/
    DeviceService.java     # Business logic layer
  resource/
    DeviceResource.java    # REST API layer
    DeviceMapper.java      # DTO mapping
    DeviceResponse.java    # Response DTOs
    CreateDeviceRequest.java  # Request DTOs
```

## Testing Conventions

- Unit tests: `*Test.java` with `@QuarkusTest`
- Integration tests: `*IT.java` with `@QuarkusIntegrationTest`
- Test classes mirror production structure
- Use REST Assured for endpoint testing
- Use descriptive test method names: `shouldReturnDeviceWhenExists()`

See `.claude/specs/testing-patterns.md` for detailed test patterns.

## General Principles

- **DRY (Don't Repeat Yourself)** - Extract common logic to shared classes
- **YAGNI (You Aren't Gonna Need It)** - Don't add functionality until needed
- **Follow existing patterns** - Check similar features before implementing new patterns
- **Fail fast** - Validate early, throw exceptions for invalid state
- **Log meaningfully** - Use appropriate log levels (debug, info, warn, error)
