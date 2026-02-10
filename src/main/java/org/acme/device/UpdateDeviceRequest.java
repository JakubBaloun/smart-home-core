package org.acme.device;

import jakarta.validation.constraints.NotBlank;

public record UpdateDeviceRequest(
        @NotBlank(message = "friendlyName must not be blank")
        String friendlyName
) {}
