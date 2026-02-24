package io.smarthome.core.telemetry.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "influxdb")
public interface InfluxDbConfig {
    String url();

    String token();

    String org();

    String bucket();
}
