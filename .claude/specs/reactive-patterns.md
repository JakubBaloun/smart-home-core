# Reactive Patterns

> Quarkus Reactive programming patterns with Mutiny for Smart Home Core.

## Core Concepts

Smart Home Core uses **Quarkus Reactive** stack with **Mutiny** library:
- **Non-blocking I/O:** All database and external calls are asynchronous
- **Reactive types:** `Uni<T>` for single value, `Multi<T>` for streams
- **Hibernate Reactive:** Replaces blocking Hibernate ORM
- **Reactive REST:** Non-blocking REST endpoints

## Uni vs Multi

| Type | Use Case | Example |
|------|----------|---------|
| `Uni<T>` | Single value or empty | `findById()`, `save()`, `update()` |
| `Multi<T>` | Stream of values | `findAll()`, `streamTelemetry()` |

## Repository Patterns

### Basic CRUD

```java
@ApplicationScoped
public class DeviceRepository {

    @Inject
    Mutiny.SessionFactory sessionFactory;

    public Uni<Device> findById(Long id) {
        return sessionFactory.withSession(session ->
                session.find(Device.class, id)
        );
    }

    public Uni<Device> save(Device device) {
        return sessionFactory.withTransaction((session, tx) ->
                session.persist(device)
                        .replaceWith(device)
        );
    }

    public Uni<Device> update(Device device) {
        return sessionFactory.withTransaction((session, tx) ->
                session.merge(device)
        );
    }

    public Uni<Void> delete(Long id) {
        return sessionFactory.withTransaction((session, tx) ->
                session.find(Device.class, id)
                        .chain(device -> session.remove(device))
        );
    }
}
```

### Query Patterns

```java
// Single result with optional
public Uni<Device> findByIeeeAddress(String ieeeAddress) {
    return sessionFactory.withSession(session ->
            session.createQuery("FROM Device WHERE ieeeAddress = :addr", Device.class)
                    .setParameter("addr", ieeeAddress)
                    .getSingleResultOrNull()
    );
}

// Multiple results as Multi
public Multi<Device> findByType(DeviceType type) {
    return sessionFactory.withSession(session ->
            session.createQuery("FROM Device WHERE type = :type", Device.class)
                    .setParameter("type", type)
                    .getResultStream()
    );
}

// Multiple results as Uni<List>
public Uni<List<Device>> findAllByRoom(String room) {
    return sessionFactory.withSession(session ->
            session.createQuery("FROM Device WHERE room = :room", Device.class)
                    .setParameter("room", room)
                    .getResultList()
    );
}
```

## Service Patterns

### Simple Delegation

```java
@ApplicationScoped
public class DeviceService {

    @Inject
    DeviceRepository repository;

    // Simple pass-through - no need for complex chain
    public Uni<Device> getDevice(Long id) {
        return repository.findById(id);
    }
}
```

### Complex Operations

```java
@ApplicationScoped
public class DeviceService {

    @Inject
    DeviceRepository repository;

    @Inject
    @Slf4j
    Logger log;

    public Uni<Device> updateDeviceState(Long id, String state) {
        return repository.findById(id)
                // Fail fast if not found
                .onItem().ifNull().failWith(() -> new DeviceNotFoundException(id))
                // Log before update
                .invoke(device -> log.debug("Updating device state: {} -> {}", device.getId(), state))
                // Perform update
                .chain(device -> {
                    device.setState(state);
                    device.setLastUpdated(Instant.now());
                    return repository.update(device);
                })
                // Log after success
                .invoke(device -> log.info("Device state updated: {}", device.getId()))
                // Log on failure
                .onFailure().invoke(err -> log.error("Failed to update device state: {}", id, err));
    }
}
```

## Resource (REST) Patterns

### Basic CRUD Endpoints

```java
@Path("/devices")
@ApplicationScoped
public class DeviceResource {

    @Inject
    DeviceService service;

    @Inject
    DeviceMapper mapper;

    @GET
    @Path("/{id}")
    public Uni<Response> getDevice(@PathParam("id") Long id) {
        return service.getDevice(id)
                .map(device -> Response.ok(mapper.toResponse(device)).build())
                .onFailure(DeviceNotFoundException.class)
                .recoverWithItem(err -> Response.status(404).entity(err.getMessage()).build());
    }

    @POST
    public Uni<Response> createDevice(CreateDeviceRequest request) {
        return service.createDevice(request)
                .map(device -> Response.status(201).entity(mapper.toResponse(device)).build())
                .onFailure().recoverWithItem(err ->
                        Response.status(400).entity("Failed: " + err.getMessage()).build()
                );
    }
}
```

### Validation Patterns

```java
@PUT
@Path("/{id}")
public Uni<Response> updateDevice(@PathParam("id") Long id, UpdateDeviceRequest request) {
    // Synchronous validation - fail fast
    if (request.name() == null || request.name().isBlank()) {
        return Uni.createFrom().item(
                Response.status(400).entity("Name is required").build()
        );
    }

    // Async operation
    return service.updateDevice(id, request)
            .map(device -> Response.ok(mapper.toResponse(device)).build())
            .onFailure(DeviceNotFoundException.class)
            .recoverWithItem(err -> Response.status(404).build())
            .onFailure().recoverWithItem(err ->
                    Response.status(500).entity("Internal error").build()
            );
}
```

## Error Handling

### Typed Error Recovery

```java
return service.getDevice(id)
        // Handle specific exception type
        .onFailure(DeviceNotFoundException.class)
        .recoverWithItem(err -> null)
        // Handle validation errors
        .onFailure(ValidationException.class)
        .recoverWithUni(err -> Uni.createFrom().failure(new BadRequestException(err)))
        // Handle all other failures
        .onFailure().recoverWithItem(err -> {
            log.error("Unexpected error", err);
            return null;
        });
```

### Retry Patterns

```java
// Retry on failure
return mqttClient.publish(topic, payload)
        .onFailure().retry().atMost(3)
        .onFailure().recoverWithItem(() -> {
            log.error("Failed after 3 retries");
            return null;
        });

// Retry with backoff
return externalApi.call()
        .onFailure().retry()
        .withBackOff(Duration.ofSeconds(1), Duration.ofSeconds(10))
        .atMost(5);
```

## Combining Multiple Unis

### Sequential Operations

```java
public Uni<Device> registerAndConfigureDevice(String ieeeAddress) {
    return zigbeeService.discoverDevice(ieeeAddress)
            // Chain: wait for first to complete
            .chain(deviceInfo -> {
                Device device = new Device();
                device.setIeeeAddress(ieeeAddress);
                device.setModel(deviceInfo.model());
                return repository.save(device);
            })
            // Chain another operation
            .chain(device -> mqttService.subscribeToDevice(device.getIeeeAddress())
                    .replaceWith(device)
            );
}
```

### Parallel Operations

```java
public Uni<DeviceStats> getDeviceStats(Long deviceId) {
    Uni<Device> deviceUni = repository.findById(deviceId);
    Uni<Long> telemetryCount = telemetryService.countByDevice(deviceId);
    Uni<Instant> lastSeen = telemetryService.getLastSeenTime(deviceId);

    // Combine all three in parallel
    return Uni.combine().all().unis(deviceUni, telemetryCount, lastSeen)
            .asTuple()
            .map(tuple -> new DeviceStats(
                    tuple.getItem1(),
                    tuple.getItem2(),
                    tuple.getItem3()
            ));
}
```

## Multi Patterns

### Stream Processing

```java
public Multi<TelemetryReading> streamLiveTelemetry(Long deviceId) {
    return telemetryRepository.streamByDevice(deviceId)
            // Filter
            .filter(reading -> reading.getValue() != null)
            // Transform
            .map(reading -> {
                reading.setProcessed(true);
                return reading;
            })
            // Side effect (logging)
            .invoke(reading -> log.debug("Streamed reading: {}", reading.getId()));
}
```

### Multi to Uni

```java
// Collect all items into list
public Uni<List<Device>> getAllDevices() {
    return repository.findAll()
            .collect().asList();
}

// Count items
public Uni<Long> countActiveDevices() {
    return repository.findByStatus(DeviceStatus.ACTIVE)
            .collect().count();
}
```

## Anti-Patterns to Avoid

### ❌ Blocking Reactive Chains

```java
// NEVER do this - breaks reactivity
public Device getDevice(Long id) {
    return repository.findById(id).await().indefinitely();  // BAD!
}
```

### ❌ Nested Subscribes

```java
// NEVER do this - use .chain() instead
public Uni<Device> updateDevice(Long id) {
    repository.findById(id).subscribe().with(device -> {  // BAD!
        device.setName("New name");
        repository.update(device);  // Lost reactivity!
    });
}

// DO this instead
return repository.findById(id)
        .chain(device -> {
            device.setName("New name");
            return repository.update(device);  // Properly chained
        });
```

### ❌ Ignoring Failures

```java
// BAD - no error handling
return service.updateDevice(id, request)
        .map(device -> Response.ok(device).build());

// GOOD - handle failures
return service.updateDevice(id, request)
        .map(device -> Response.ok(device).build())
        .onFailure().recoverWithItem(err ->
                Response.status(500).entity("Error: " + err.getMessage()).build()
        );
```

## Testing Reactive Code

```java
@Test
void shouldReturnDevice() {
    Device device = Device.builder()
            .id(1L)
            .name("Test Device")
            .build();

    when(repository.findById(1L)).thenReturn(Uni.createFrom().item(device));

    Uni<Device> result = service.getDevice(1L);

    // Assert using await in tests (acceptable)
    Device actual = result.await().indefinitely();
    assertEquals("Test Device", actual.getName());
}
```

See `.claude/specs/testing-patterns.md` for more test patterns.
