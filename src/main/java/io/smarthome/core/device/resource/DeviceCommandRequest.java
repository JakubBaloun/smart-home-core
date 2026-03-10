package io.smarthome.core.device.resource;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.constraints.NotBlank;

public record DeviceCommandRequest(
        @NotBlank String command,
        ObjectNode payload
) {}
