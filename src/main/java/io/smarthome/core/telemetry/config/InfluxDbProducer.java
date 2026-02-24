package io.smarthome.core.telemetry.config;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import com.influxdb.client.QueryApi;
import com.influxdb.client.WriteApiBlocking;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

@ApplicationScoped
public class InfluxDbProducer {

    @Inject
    InfluxDbConfig config;

    private InfluxDBClient client;

    @Produces
    @ApplicationScoped
    public InfluxDBClient influxDBClient() {
        client = InfluxDBClientFactory.create(
                config.url(),
                config.token().toCharArray(),
                config.org(),
                config.bucket()
        );

        return client;
    }

    @Produces
    @ApplicationScoped
    public WriteApiBlocking writeApi(InfluxDBClient client) {
        return client.getWriteApiBlocking();
    }

    @Produces
    @ApplicationScoped
    public QueryApi queryApi(InfluxDBClient client) {
        return client.getQueryApi();
    }

    @PreDestroy
    public void cleanUp() {
        if(client != null){
            client.close();
        }
    }
}
