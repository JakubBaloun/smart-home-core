package io.smarthome.core.automation;

import java.time.Instant;
import java.util.Map;

public record RuleContext(String eventType, String deviceId, Map<String, Object> data, Instant timestamp) {

    public RuleContext {
        data = data == null ? Map.of() : Map.copyOf(data);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String eventType;
        private String deviceId;
        private Map<String, Object> data = Map.of();
        private Instant timestamp = Instant.now();

        public Builder eventType(String eventType) {
            this.eventType = eventType;
            return this;
        }

        public Builder deviceId(String deviceId) {
            this.deviceId = deviceId;
            return this;
        }

        public Builder data(Map<String, Object> data) {
            this.data = data;
            return this;
        }

        public Builder timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public RuleContext build() {
            return new RuleContext(eventType, deviceId, data, timestamp);
        }
    }
}
