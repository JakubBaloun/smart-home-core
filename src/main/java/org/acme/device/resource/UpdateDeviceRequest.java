package org.acme.device.resource;

import jakarta.validation.constraints.NotBlank;
import org.acme.device.DeviceType;

public record UpdateDeviceRequest(
        @NotBlank(message = "friendlyName must not be blank")
        String friendlyName,
        DeviceType type
) {}
