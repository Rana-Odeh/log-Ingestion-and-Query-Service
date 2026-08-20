CREATE TABLE logs_rollup_hourly (
  bucket_start TIMESTAMPTZ NOT NULL,
  service VARCHAR(255) NOT NULL,
  level log_level NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_start, service, level)
);

CREATE INDEX idx_rollup_bucket ON logs_rollup_hourly (bucket_start);

