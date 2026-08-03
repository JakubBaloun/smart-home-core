CREATE TABLE calendar_event (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    person VARCHAR(10),
    event_date DATE NOT NULL,
    event_time TIME,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_calendar_event_person CHECK (person IN ('KUBA', 'PETA', 'BOTH'))
);
CREATE INDEX idx_calendar_event_event_date ON calendar_event(event_date);
