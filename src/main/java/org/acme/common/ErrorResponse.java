package org.acme.common;

import lombok.Builder;

@Builder
public record ErrorResponse(
        String title,
        String detail,
        int status
) {}
