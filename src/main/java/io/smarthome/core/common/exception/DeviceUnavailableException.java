package io.smarthome.core.common.exception;

public class DeviceUnavailableException extends RuntimeException {

    public DeviceUnavailableException(String friendlyName) {
        super("Device '" + friendlyName + "' is not available");
    }
}
