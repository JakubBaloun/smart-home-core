package org.acme.device;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "device")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Device extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "ieee_address", nullable = false, unique = true)
    public String ieeeAddress;

    @Column(name = "friendly_name", nullable = false)
    public String friendlyName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    public DeviceType type = DeviceType.OTHER;

    public String vendor;

    public String model;

    public boolean available;

    @Column(name = "last_seen")
    public OffsetDateTime lastSeen;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    public OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    public OffsetDateTime updatedAt = OffsetDateTime.now();
}
