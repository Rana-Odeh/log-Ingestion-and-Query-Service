CREATE EXTENSION IF NOT EXISTS pgcrypto;  
CREATE EXTENSION IF NOT EXISTS pg_trgm;   

CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error');

CREATE TABLE logs (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMPTZ NOT NULL,
    level       log_level NOT NULL,
    service     VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    attributes  JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (id, "timestamp")
) PARTITION BY RANGE ("timestamp");


CREATE TABLE logs_default PARTITION OF logs DEFAULT;


CREATE INDEX idx_logs_timestamp_id ON logs ("timestamp" DESC, id DESC);

CREATE INDEX idx_logs_service_level_timestamp ON logs (service, level, "timestamp" DESC);

CREATE INDEX idx_logs_attributes ON logs USING GIN (attributes);


CREATE INDEX idx_logs_message_trgm ON logs USING GIN (message gin_trgm_ops);
