package io.smarthome.core.device.repository;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import io.smarthome.core.device.Device;
import io.smarthome.core.device.DeviceType;
import org.hibernate.reactive.mutiny.Mutiny.Session;

import java.time.OffsetDateTime;
import java.util.List;

@ApplicationScoped
public class DeviceRepository {

    public static final String HQL_LIST_DEVICES  = """
            FROM Device
            """;

    public static final String HQL_FIND_DEVICE_BY_ID  = """
            FROM Device WHERE id = :id
            """;

    public static final String HQL_FIND_DEVICES_BY_TYPE  = """
            FROM Device WHERE type = :type
            """;

    public static final String HQL_FIND_BY_IEEE_ADDRESS  = """
            FROM Device WHERE ieeeAddress = :ieeeAddress
            """;

    public static final String HQL_MARK_UNAVAILABLE_NOT_IN = """
            UPDATE Device SET available = false WHERE ieeeAddress NOT IN :addresses
            """;

    public static final String HQL_MARK_ALL_UNAVAILABLE = """
            UPDATE Device SET available = false
            """;

    public static final String HQL_MARK_ONLINE = """
            UPDATE Device SET available = true, lastSeen = :now, updatedAt = :now WHERE friendlyName = :name
            """;

    public static final String HQL_MARK_OFFLINE = """
            UPDATE Device SET available = false, updatedAt = :now WHERE friendlyName = :name
            """;

    public Uni<List<Device>> listAll(Session session) {
        return session.createQuery(HQL_LIST_DEVICES, Device.class).getResultList();
    }

    public Uni<Device> findById(Long id, Session session) {
        return session.createQuery(
                        HQL_FIND_DEVICE_BY_ID, Device.class)
                        .setParameter("id", id)
                        .getSingleResultOrNull();
    }

    public Uni<List<Device>> findByType(DeviceType type, Session session) {
        return session.createQuery(
                HQL_FIND_DEVICES_BY_TYPE, Device.class)
                .setParameter("type", type)
                .getResultList();
    }

    public Uni<Device> findByIeeeAddress(String ieeeAddress, Session session) {
        return session.createQuery(
                        HQL_FIND_BY_IEEE_ADDRESS, Device.class)
                        .setParameter("ieeeAddress", ieeeAddress)
                        .getSingleResultOrNull();
    }

    public Uni<Void> save(Device device, Session session) {
        return session.persist(device).replaceWithVoid();
    }

    public Uni<Void> delete(Device device, Session session) {
        return session.remove(device).replaceWithVoid();
    }

    public Uni<Void> update(Device device, Session session) {
        return session.merge(device).replaceWithVoid();
    }

    public Uni<Integer> updateAvailability(String friendlyName, boolean available, Session session) {
        return session.createMutationQuery(available ? HQL_MARK_ONLINE : HQL_MARK_OFFLINE)
                .setParameter("name", friendlyName)
                .setParameter("now", OffsetDateTime.now())
                .executeUpdate();
    }

    public Uni<Integer> markUnavailableNotIn(List<String> activeAddresses, Session session) {
        if (activeAddresses == null || activeAddresses.isEmpty()) {
            return session.createMutationQuery(HQL_MARK_ALL_UNAVAILABLE)
                    .executeUpdate();
        }

        return session.createMutationQuery(HQL_MARK_UNAVAILABLE_NOT_IN)
                .setParameter("addresses", activeAddresses)
                .executeUpdate();
    }
}
