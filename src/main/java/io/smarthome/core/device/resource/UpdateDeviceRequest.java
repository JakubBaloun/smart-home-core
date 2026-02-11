package io.smarthome.core.device.resource;

import jakarta.validation.constraints.NotBlank;
import io.smarthome.core.device.DeviceType;

public record UpdateDeviceRequest(
        @NotBlank(message = "friendlyName must not be blank")
        String friendlyName,
        DeviceType type
) {}
