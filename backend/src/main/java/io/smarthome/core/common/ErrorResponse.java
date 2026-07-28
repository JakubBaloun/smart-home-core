package io.smarthome.core.common;

import lombok.Builder;

@Builder
public record ErrorResponse(
        String title,
        String detail,
        int status
) {}
