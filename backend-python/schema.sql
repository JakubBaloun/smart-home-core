-- Verbatim copy of backend/src/main/resources/db/migration/*.sql, concatenated.
-- The Python backend owns NO migrations: Flyway (Quarkus) stays the single
-- schema owner. This file exists only to bootstrap a throwaway parity database
-- or a test container. Keep it byte-identical in content to the Flyway scripts.

-- V1.0.0__Initial_Setup.sql
CREATE TABLE schema_info (
    id INT PRIMARY KEY,
    description TEXT
);

-- V1.1.0__Create_Device_Table.sql
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

-- V1.2.0__Create_Recipe_Tables.sql
CREATE TABLE recipe (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    servings_base INTEGER NOT NULL DEFAULT 4,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recipe_servings_base_positive CHECK (servings_base > 0)
);
CREATE INDEX idx_recipe_title ON recipe(title);

CREATE TABLE recipe_ingredient (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20),
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_recipe_ingredient_recipe_id ON recipe_ingredient(recipe_id);
CREATE INDEX idx_recipe_ingredient_name ON recipe_ingredient(name);

CREATE TABLE recipe_step (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    timer_seconds INTEGER,
    CONSTRAINT chk_recipe_step_timer_positive CHECK (timer_seconds IS NULL OR timer_seconds > 0),
    CONSTRAINT uq_recipe_step_recipe_id_step_number UNIQUE (recipe_id, step_number)
);
CREATE INDEX idx_recipe_step_recipe_id ON recipe_step(recipe_id);

CREATE TABLE tag (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);
CREATE INDEX idx_tag_name ON tag(name);

CREATE TABLE recipe_tag (
    recipe_id BIGINT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (recipe_id, tag_id)
);
CREATE INDEX idx_recipe_tag_tag_id ON recipe_tag(tag_id);
