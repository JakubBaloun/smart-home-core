package io.smarthome.core.exception;

public class TelemetryException extends RuntimeException {
    public TelemetryException(String message, Throwable cause) {
        super(message, cause);
    }
}