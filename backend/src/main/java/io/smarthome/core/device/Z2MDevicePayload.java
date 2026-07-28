package io.smarthome.core.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Z2MDevicePayload(
        @JsonProperty("ieee_address") String ieeeAddress,
        @JsonProperty("friendly_name") String friendlyName,
        String type,
        String vendor,
        String model,
        // Z2M often nests capabilities/description under 'definition'
        Definition definition
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Definition(
            String description,
            String model,
            String vendor
    ) {}
}
