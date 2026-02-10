CREATE TABLE device (
    id BIGSERIAL PRIMARY KEY,
    ieee_address VARCHAR(24) NOT NULL UNIQUE,
    friendly_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    vendor VARCHAR(255),
    model VARCHAR(255),
    available BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_device_ieee_address ON device(ieee_address);
CREATE INDEX idx_device_type ON device(type);
