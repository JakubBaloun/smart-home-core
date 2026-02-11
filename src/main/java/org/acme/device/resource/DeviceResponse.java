package org.acme.device.resource;

import lombok.Builder;
import org.acme.device.DeviceType;

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
