
CREATE OR REPLACE FUNCTION update_logs_rollup() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO logs_rollup_hourly (bucket_start, service, level, count)
  SELECT
    date_trunc('hour', new_rows.timestamp) AS bucket_start,
    new_rows.service,
    new_rows.level,
    COUNT(*)::bigint AS count
  FROM new_rows
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3
  ON CONFLICT (bucket_start, service, level)
  DO UPDATE SET count = logs_rollup_hourly.count + EXCLUDED.count;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_logs_rollup
AFTER INSERT ON logs
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION update_logs_rollup();