package io.smarthome.core.device.resource;

import lombok.Builder;
import io.smarthome.core.device.DeviceType;

import java.time.OffsetDateTime;

@Builder
public record DeviceResponse(
        Long id,
        String ieeeAddress,
        String friendlyName,
        DeviceType type,
        String vendor,
        String model,
        boolean available,
        OffsetDateTime lastSeen,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
