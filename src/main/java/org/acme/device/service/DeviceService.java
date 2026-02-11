package org.acme.device.service;

import io.quarkus.logging.Log;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.acme.common.exception.ResourceNotFoundException;
import org.acme.device.Device;
import org.acme.device.repository.DeviceRepository;
import org.acme.device.resource.UpdateDeviceRequest;
import org.hibernate.reactive.mutiny.Mutiny.SessionFactory;

import java.time.OffsetDateTime;
import java.util.List;

@ApplicationScoped
public class DeviceService {

    @Inject
    SessionFactory sessionFactory;

    @Inject
    DeviceRepository deviceRepository;

    public Uni<List<Device>> getAllDevices() {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Getting all devices from the database"))
                .chain(() -> sessionFactory.withSession(session ->
                        deviceRepository.listAll(session))
                )
                .invoke((devices) -> Log.infof("Successfully retrieved %d devices from the database", devices.size()))
                .onFailure()
                .invoke(e -> Log.errorf("Failed to retrieve devices from the database: %s", e.getMessage()));
    }

    public Uni<Device> getDeviceById(Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Getting device with id %d from the database", id))
                .chain(() -> sessionFactory.withSession(session ->
                        deviceRepository.findById(id, session))
                        .chain(device -> {
                            if (device == null) {
                                return Uni.createFrom().failure(new ResourceNotFoundException("Device", id));
                            }
                            return Uni.createFrom().item(device);
                        })
                )
                .invoke((device) -> Log.infof("Device with id %d retrieved successfully: %s", id, device))
                .onFailure()
                .invoke(e -> Log.errorf("Failed to retrieve device with id %d from the database: %s", id, e.getMessage()));
    }

    public Uni<Void> updateDevice(Long id, UpdateDeviceRequest request) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Updating device with id %d in the database", id))
                .chain(() -> sessionFactory.withTransaction(session ->
                        deviceRepository.findById(id, session)
                                .chain(device -> {
                                    if (device == null) {
                                        return Uni.createFrom().failure(new ResourceNotFoundException("Device", id));
                                    }
                                    device.setFriendlyName(request.friendlyName());
                                    if (request.type() != null) {
                                        device.setType(request.type());
                                    }
                                    device.setUpdatedAt(OffsetDateTime.now());
                                    return deviceRepository.update(device, session);
                                })
                ))
                .invoke(() -> Log.infof("Device with id %d updated successfully", id))
                .onFailure()
                .invoke(e -> Log.errorf("Failed to update device with id %d in the database: %s", id, e.getMessage()));
    }

    public Uni<Void> deleteDevice(Long id) {
        return Uni.createFrom().voidItem()
                .invoke(() -> Log.infof("Deleting device with id %d from the database", id))
                .chain(() -> sessionFactory.withTransaction(session ->
                        deviceRepository.findById(id, session)
                                .chain(device -> {
                                    if (device == null) {
                                        return Uni.createFrom().failure(new ResourceNotFoundException("Device", id));
                                    }
                                    return deviceRepository.delete(device, session);
                                })
                ))
                .invoke(() -> Log.infof("Device with id %d deleted successfully", id))
                .onFailure()
                .invoke(e -> Log.errorf("Failed to delete device with id %d from the database: %s", id, e.getMessage()));
    }
}
