package org.acme.common.exception;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.ws.rs.core.Response;
import org.acme.common.ErrorResponse;
import org.jboss.resteasy.reactive.RestResponse;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

public class GlobalExceptionHandler {

    @ServerExceptionMapper
    public RestResponse<ErrorResponse> handleResourceNotFound(ResourceNotFoundException e) {
        ErrorResponse error = ErrorResponse.builder()
                .title("Not Found")
                .detail(e.getMessage())
                .status(Response.Status.NOT_FOUND.getStatusCode())
                .build();
        return RestResponse.status(Response.Status.NOT_FOUND, error);
    }

    @ServerExceptionMapper
    public RestResponse<ErrorResponse> handleInvalidFormat(InvalidFormatException e) {
        ErrorResponse error = ErrorResponse.builder()
                .title("Bad Request")
                .detail(e.getOriginalMessage())
                .status(Response.Status.BAD_REQUEST.getStatusCode())
                .build();
        return RestResponse.status(Response.Status.BAD_REQUEST, error);
    }
}
