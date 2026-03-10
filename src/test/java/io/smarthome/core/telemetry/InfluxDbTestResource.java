package io.smarthome.core.telemetry;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.util.Map;

public class InfluxDbTestResource implements QuarkusTestResourceLifecycleManager {

    static final String TOKEN = "test-integration-token";
    static final String ORG = "smart-home";
    static final String BUCKET = "telemetry";

    @SuppressWarnings("resource")
    private static final GenericContainer<?> CONTAINER =
            new GenericContainer<>(DockerImageName.parse("influxdb:2.7-alpine"))
                    .withExposedPorts(8086)
                    .withEnv("DOCKER_INFLUXDB_INIT_MODE", "setup")
                    .withEnv("DOCKER_INFLUXDB_INIT_USERNAME", "admin")
                    .withEnv("DOCKER_INFLUXDB_INIT_PASSWORD", "adminpassword")
                    .withEnv("DOCKER_INFLUXDB_INIT_ORG", ORG)
                    .withEnv("DOCKER_INFLUXDB_INIT_BUCKET", BUCKET)
                    .withEnv("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN", TOKEN)
                    .waitingFor(Wait.forHttp("/ping").forPort(8086).forStatusCode(204));

    @Override
    public Map<String, String> start() {
        CONTAINER.start();
        String url = "http://" + CONTAINER.getHost() + ":" + CONTAINER.getMappedPort(8086);
        return Map.of(
                "influxdb.url", url,
                "influxdb.token", TOKEN,
                "influxdb.org", ORG,
                "influxdb.bucket", BUCKET
        );
    }

    @Override
    public void stop() {
        if (CONTAINER.isRunning()) {
            CONTAINER.stop();
        }
    }
}
