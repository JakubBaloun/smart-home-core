package io.smarthome.core.device.resource;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import io.smarthome.core.common.exception.DeviceUnavailableException;
import io.smarthome.core.device.service.DeviceCommandService;
import io.smarthome.core.device.service.DeviceService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestPath;

@Path("/api/devices/{id}/command")
@ApplicationScoped
public class CommandResource {

    @Inject
    DeviceService deviceService;

    @Inject
    DeviceCommandService commandService;

    @POST
    public Uni<Response> sendCommand(@RestPath Long id, @Valid DeviceCommandRequest request) {
        Log.infof("Command request received for device %d: %s", id, request.command());

        return deviceService.getDeviceById(id)
                .chain(device -> {
                    if (!device.isAvailable()) {
                        return Uni.createFrom().failure(new DeviceUnavailableException(device.getFriendlyName()));
                    }
                    return routeCommand(device.getFriendlyName(), request);
                })
                .map(ignored -> Response.accepted().build());
    }

    private Uni<Void> routeCommand(String friendlyName, DeviceCommandRequest request) {
        ObjectNode payload = request.payload();

        return switch (request.command()) {
            case "setState" -> {
                requireField(payload, "state");
                yield commandService.setState(friendlyName, payload.get("state").asText());
            }
            case "setBrightness" -> {
                requireField(payload, "brightness");
                yield commandService.setBrightness(friendlyName, payload.get("brightness").asInt());
            }
            case "setColorTemp" -> {
                requireField(payload, "color_temp");
                yield commandService.setColorTemp(friendlyName, payload.get("color_temp").asInt());
            }
            case "raw" -> {
                if (payload == null) throw new BadRequestException("payload is required for 'raw' command");
                yield commandService.sendRawCommand(friendlyName, payload);
            }
            default -> Uni.createFrom().failure(new BadRequestException("Unknown command: '" + request.command() + "'"));
        };
    }

    private void requireField(ObjectNode payload, String field) {
        if (payload == null || !payload.has(field)) {
            throw new BadRequestException("payload must contain '" + field + "'");
        }
    }
}
