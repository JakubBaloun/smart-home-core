# Testing Patterns

> Testing conventions and patterns for Smart Home Core with Quarkus, JUnit 5, and REST Assured.

## Test Types

| Type | Annotation | File Suffix | Scope |
|------|-----------|-------------|-------|
| Unit Test | `@QuarkusTest` | `*Test.java` | Single class/feature, mocked dependencies |
| Integration Test | `@QuarkusIntegrationTest` | `*IT.java` | Full app, real database, Docker container |

**Integration tests are skipped by default.** Run with: `./mvnw verify -DskipITs=false`

## Project Structure

Tests mirror production structure:

```
src/
├── main/java/org/acme/device/
│   ├── Device.java
│   ├── repository/DeviceRepository.java
│   ├── service/DeviceService.java
│   └── resource/DeviceResource.java
└── test/java/org/acme/device/
    ├── DeviceTest.java                    # Unit tests (various aspects)
    ├── DeviceIT.java                      # Integration tests
    ├── repository/DeviceRepositoryTest.java
    ├── service/DeviceServiceTest.java
    └── resource/DeviceResourceTest.java
```

## Unit Tests

### Basic Test Structure

```java
@QuarkusTest
class DeviceServiceTest {

    @Inject
    DeviceService service;

    @InjectMock
    DeviceRepository repository;

    @Test
    void shouldReturnDeviceWhenExists() {
        // Given
        Device device = Device.builder()
                .id(1L)
                .name("Test Device")
                .ieeeAddress("0x00124b001f2e3a45")
                .type(DeviceType.LIGHT)
                .build();

        when(repository.findById(1L)).thenReturn(Uni.createFrom().item(device));

        // When
        Uni<Device> result = service.getDevice(1L);

        // Then
        Device actual = result.await().indefinitely();
        assertNotNull(actual);
        assertEquals("Test Device", actual.getName());
        assertEquals(DeviceType.LIGHT, actual.getType());

        verify(repository).findById(1L);
    }

    @Test
    void shouldThrowExceptionWhenDeviceNotFound() {
        // Given
        when(repository.findById(99L)).thenReturn(Uni.createFrom().nullItem());

        // When
        Uni<Device> result = service.getDevice(99L);

        // Then
        assertThrows(DeviceNotFoundException.class, () ->
                result.await().indefinitely()
        );
    }
}
```

### Testing Reactive Code

```java
@Test
void shouldUpdateDeviceState() {
    Device device = createTestDevice();
    Device updated = Device.builder()
            .id(1L)
            .name("Test Device")
            .state("ON")
            .build();

    when(repository.findById(1L)).thenReturn(Uni.createFrom().item(device));
    when(repository.update(any(Device.class))).thenReturn(Uni.createFrom().item(updated));

    // Await in tests is acceptable
    Device result = service.updateState(1L, "ON")
            .await().indefinitely();

    assertEquals("ON", result.getState());
}

@Test
void shouldHandleFailureGracefully() {
    when(repository.findById(1L))
            .thenReturn(Uni.createFrom().failure(new RuntimeException("DB error")));

    // Use AssertJ or assertThrows
    assertThrows(RuntimeException.class, () ->
            service.getDevice(1L).await().indefinitely()
    );
}
```

## REST Endpoint Tests

### Using REST Assured

```java
@QuarkusTest
class DeviceResourceTest {

    @InjectMock
    DeviceService service;

    @InjectMock
    DeviceMapper mapper;

    @Test
    void shouldReturnDeviceById() {
        Device device = createTestDevice();
        DeviceResponse response = new DeviceResponse(
                1L, "Test Device", "0x001", DeviceType.LIGHT, "ON", "Living Room"
        );

        when(service.getDevice(1L)).thenReturn(Uni.createFrom().item(device));
        when(mapper.toResponse(device)).thenReturn(response);

        given()
                .when().get("/devices/1")
                .then()
                .statusCode(200)
                .body("id", equalTo(1))
                .body("name", equalTo("Test Device"))
                .body("type", equalTo("LIGHT"));
    }

    @Test
    void shouldReturn404WhenDeviceNotFound() {
        when(service.getDevice(99L))
                .thenReturn(Uni.createFrom().failure(new DeviceNotFoundException(99L)));

        given()
                .when().get("/devices/99")
                .then()
                .statusCode(404);
    }

    @Test
    void shouldCreateDevice() {
        CreateDeviceRequest request = new CreateDeviceRequest(
                "New Device", "0x002", DeviceType.SENSOR, "Kitchen"
        );
        Device device = createTestDevice();
        DeviceResponse response = new DeviceResponse(
                1L, "New Device", "0x002", DeviceType.SENSOR, null, "Kitchen"
        );

        when(service.createDevice(any())).thenReturn(Uni.createFrom().item(device));
        when(mapper.toResponse(device)).thenReturn(response);

        given()
                .contentType("application/json")
                .body(request)
                .when().post("/devices")
                .then()
                .statusCode(201)
                .body("name", equalTo("New Device"));
    }

    @Test
    void shouldValidateRequestBody() {
        given()
                .contentType("application/json")
                .body("{\"name\": \"\"}") // Invalid: empty name
                .when().post("/devices")
                .then()
                .statusCode(400);
    }
}
```

### Testing Query Parameters

```java
@Test
void shouldFilterDevicesByType() {
    List<Device> devices = List.of(
            createTestDevice(1L, DeviceType.LIGHT),
            createTestDevice(2L, DeviceType.LIGHT)
    );

    when(service.findByType(DeviceType.LIGHT))
            .thenReturn(Multi.createFrom().iterable(devices));

    given()
            .queryParam("type", "LIGHT")
            .when().get("/devices")
            .then()
            .statusCode(200)
            .body("$.size()", equalTo(2));
}
```

## Integration Tests

### Basic Integration Test

```java
@QuarkusIntegrationTest
class DeviceResourceIT {

    @Test
    void shouldCreateAndRetrieveDevice() {
        // Create device
        CreateDeviceRequest request = new CreateDeviceRequest(
                "Integration Test Device",
                "0x00124b001f2e3a99",
                DeviceType.LIGHT,
                "Test Room"
        );

        String location = given()
                .contentType("application/json")
                .body(request)
                .when().post("/devices")
                .then()
                .statusCode(201)
                .extract().header("Location");

        // Retrieve device
        given()
                .when().get(location)
                .then()
                .statusCode(200)
                .body("name", equalTo("Integration Test Device"))
                .body("ieeeAddress", equalTo("0x00124b001f2e3a99"));
    }

    @Test
    void shouldUpdateDevice() {
        // Create device first
        Long deviceId = createTestDeviceViaApi();

        // Update it
        UpdateDeviceRequest update = new UpdateDeviceRequest(
                "Updated Name", "New Room"
        );

        given()
                .contentType("application/json")
                .body(update)
                .when().put("/devices/" + deviceId)
                .then()
                .statusCode(200)
                .body("name", equalTo("Updated Name"))
                .body("room", equalTo("New Room"));
    }

    private Long createTestDeviceViaApi() {
        CreateDeviceRequest request = new CreateDeviceRequest(
                "Test", "0x001", DeviceType.LIGHT, "Room"
        );

        return given()
                .contentType("application/json")
                .body(request)
                .when().post("/devices")
                .then()
                .extract().body().jsonPath().getLong("id");
    }
}
```

### Database Integration Tests

```java
@QuarkusTest
@TestTransaction
class DeviceRepositoryTest {

    @Inject
    DeviceRepository repository;

    @Test
    void shouldSaveAndFindDevice() {
        Device device = Device.builder()
                .name("Test Device")
                .ieeeAddress("0x001")
                .type(DeviceType.LIGHT)
                .build();

        // Save
        Device saved = repository.save(device)
                .await().indefinitely();

        assertNotNull(saved.getId());

        // Find
        Device found = repository.findById(saved.getId())
                .await().indefinitely();

        assertEquals("Test Device", found.getName());
    }

    @Test
    void shouldFindByIeeeAddress() {
        Device device = createAndSaveDevice("0x123456789abcdef");

        Device found = repository.findByIeeeAddress("0x123456789abcdef")
                .await().indefinitely();

        assertNotNull(found);
        assertEquals(device.getId(), found.getId());
    }

    private Device createAndSaveDevice(String ieeeAddress) {
        Device device = Device.builder()
                .name("Test")
                .ieeeAddress(ieeeAddress)
                .type(DeviceType.LIGHT)
                .build();

        return repository.save(device).await().indefinitely();
    }
}
```

## Test Data Builders

### Builder Pattern for Test Fixtures

```java
public class DeviceTestBuilder {

    public static Device.DeviceBuilder defaultDevice() {
        return Device.builder()
                .id(1L)
                .name("Test Device")
                .ieeeAddress("0x00124b001f2e3a45")
                .type(DeviceType.LIGHT)
                .state("OFF")
                .room("Living Room")
                .createdAt(Instant.now())
                .updatedAt(Instant.now());
    }

    public static Device createLightDevice(String name) {
        return defaultDevice()
                .name(name)
                .type(DeviceType.LIGHT)
                .build();
    }

    public static Device createSensorDevice(String name) {
        return defaultDevice()
                .name(name)
                .type(DeviceType.SENSOR)
                .state(null) // Sensors don't have state
                .build();
    }
}
```

## Mocking Patterns

### Mocking Repositories

```java
@InjectMock
DeviceRepository repository;

@BeforeEach
void setup() {
    // Common mock setup
    when(repository.findAll())
            .thenReturn(Multi.createFrom().items(
                    createDevice(1L),
                    createDevice(2L)
            ));
}
```

### Mocking Reactive Return Types

```java
// Return Uni
when(service.getDevice(1L))
        .thenReturn(Uni.createFrom().item(device));

// Return empty Uni
when(service.getDevice(99L))
        .thenReturn(Uni.createFrom().nullItem());

// Return failure
when(service.getDevice(99L))
        .thenReturn(Uni.createFrom().failure(new DeviceNotFoundException(99L)));

// Return Multi
when(repository.findAll())
        .thenReturn(Multi.createFrom().items(device1, device2));
```

## Test Profiles

### Custom Test Configuration

```java
public class DeviceTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "quarkus.datasource.db-kind", "h2",
                "quarkus.datasource.username", "test",
                "quarkus.datasource.password", "test",
                "mqtt.broker-url", "tcp://localhost:1883"
        );
    }

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of(MockMqttClient.class);
    }
}

@QuarkusTest
@TestProfile(DeviceTestProfile.class)
class DeviceWithCustomProfileTest {
    // Tests using custom profile
}
```

## Testing Reactive Streams (Multi)

```java
@Test
void shouldStreamAllDevices() {
    List<Device> devices = List.of(
            createDevice(1L),
            createDevice(2L),
            createDevice(3L)
    );

    when(repository.findAll())
            .thenReturn(Multi.createFrom().iterable(devices));

    List<Device> result = service.getAllDevices()
            .collect().asList()
            .await().indefinitely();

    assertEquals(3, result.size());
}
```

## Assertions

### Common Assertions

```java
// Basic assertions
assertEquals(expected, actual);
assertNotNull(result);
assertTrue(condition);

// Collections
assertThat(list).hasSize(3);
assertThat(list).contains(expectedItem);

// Exceptions
assertThrows(DeviceNotFoundException.class, () -> {
    service.getDevice(99L).await().indefinitely();
});

// REST Assured
.then()
    .statusCode(200)
    .body("id", equalTo(1))
    .body("name", equalTo("Test"))
    .body("devices", hasSize(3));
```

## Best Practices

1. **Use descriptive test names** - `shouldReturnDeviceWhenExists()` not `testGetDevice()`
2. **Follow AAA pattern** - Arrange, Act, Assert (Given, When, Then)
3. **One assertion per test** - Focus on single behavior
4. **Use test builders** - Keep test setup DRY
5. **Mock external dependencies** - Database, MQTT, external APIs
6. **Test edge cases** - Null values, empty lists, invalid input
7. **Use @TestTransaction** - For database tests that need rollback
8. **Await reactive types in tests** - `.await().indefinitely()` is acceptable in tests
9. **Keep tests fast** - Unit tests < 100ms, integration tests < 5s
10. **Clean up test data** - Use @TestTransaction or cleanup methods

## Common Pitfalls

### ❌ Don't Block in Production Code

```java
// BAD - blocking in service
public Device getDevice(Long id) {
    return repository.findById(id).await().indefinitely();  // Never do this!
}

// GOOD - reactive
public Uni<Device> getDevice(Long id) {
    return repository.findById(id);
}

// OK - blocking in tests
@Test
void test() {
    Device device = service.getDevice(1L).await().indefinitely();  // Fine in tests
}
```

### ❌ Don't Test Implementation Details

```java
// BAD - testing internal implementation
@Test
void shouldCallRepositoryMethod() {
    service.getDevice(1L);
    verify(repository).findById(1L);  // Testing implementation, not behavior
}

// GOOD - testing behavior
@Test
void shouldReturnDeviceWhenExists() {
    Device result = service.getDevice(1L).await().indefinitely();
    assertEquals("Test Device", result.getName());  // Testing outcome
}
```

### ❌ Don't Share Mutable State Between Tests

```java
// BAD - shared mutable state
private Device sharedDevice = new Device();  // Dangerous!

@Test
void test1() {
    sharedDevice.setName("Test 1");  // Mutates shared state
}

// GOOD - create fresh instances
@Test
void test2() {
    Device device = createTestDevice();  // Fresh instance per test
}
```
