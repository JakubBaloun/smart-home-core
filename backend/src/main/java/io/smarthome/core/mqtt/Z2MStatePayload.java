package io.smarthome.core.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;

final class Z2MStatePayload {

    private Z2MStatePayload() {
    }

    /**
     * Z2M 2.x publishes availability/bridge state as JSON ({"state":"online"}),
     * older versions as the plain string "online"/"offline".
     */
    static boolean isOnline(String payload, ObjectMapper objectMapper) {
        String trimmed = payload.trim();
        if (trimmed.startsWith("{")) {
            try {
                return "online".equalsIgnoreCase(objectMapper.readTree(trimmed).path("state").asText());
            } catch (Exception e) {
                return false;
            }
        }
        return "online".equalsIgnoreCase(trimmed);
    }
}
