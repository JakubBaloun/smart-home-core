package io.smarthome.core.device.resource;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import io.smarthome.core.device.service.DeviceService;
import org.jboss.resteasy.reactive.RestPath;

import java.util.List;

@Path("/api/devices")
@ApplicationScoped
public class DeviceResource {

    @Inject
    DeviceService deviceService;

    @Inject
    DeviceMapper deviceMapper;

    @GET
    public Uni<List<DeviceResponse>> getAllDevices() {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to get all devices"))
                .chain(() -> deviceService.getAllDevices())
                .map(deviceMapper::toResponseList);
    }

    @GET
    @Path("/{id}")
    public Uni<DeviceResponse> getDeviceById(@RestPath Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to get device with id: %d", id))
                .chain(() -> deviceService.getDeviceById(id))
                .map(deviceMapper::toResponse);
    }

    @PUT
    @Path("/{id}")
    public Uni<Void> updateDevice(@RestPath Long id, @Valid UpdateDeviceRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to update device with id: %d", id))
                .chain(() -> deviceService.updateDevice(id, request));
    }

    @DELETE
    @Path("/{id}")
    public Uni<Void> deleteDevice(@RestPath Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Request received to delete device with id: %d", id))
                .chain(() -> deviceService.deleteDevice(id));
    }
}
