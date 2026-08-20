import { pool } from "../db/client.js";

const JOB_INTERVAL_MS = 5000;

export async function aggregateLogs(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const stateResult = await client.query<{
      last_processed_minute: Date;
    }>(
      `
      SELECT last_processed_minute
      FROM log_aggregation_state
      WHERE id = 1
      FOR UPDATE
      `,
    );

    if (stateResult.rows.length === 0) {
      throw new Error("Aggregation state row not found");
    }

    const lastProcessed = stateResult.rows[0].last_processed_minute;

    const currentMinuteResult = await client.query<{
      current_minute: Date;
    }>(
      `
      SELECT date_trunc('minute', NOW()) AS current_minute
      `,
    );

    const currentMinute = currentMinuteResult.rows[0].current_minute;

    if (lastProcessed >= currentMinute) {
      await client.query("COMMIT");
      return;
    }

    await client.query(
      `
      INSERT INTO log_minute_aggregates (
        bucket_start,
        service,
        level,
        count
      )
      SELECT
        date_trunc('minute', "timestamp") AS bucket_start,
        service,
        level,
        COUNT(*)::bigint
      FROM logs
      WHERE "timestamp" >= $1
        AND "timestamp" < $2
      GROUP BY
        date_trunc('minute', "timestamp"),
        service,
        level
      ON CONFLICT (bucket_start, service, level)
      DO UPDATE SET
        count = EXCLUDED.count
      `,
      [lastProcessed, currentMinute],
    );

    await client.query(
      `
      UPDATE log_aggregation_state
      SET last_processed_minute = $1
      WHERE id = 1
      `,
      [currentMinute],
    );

    await client.query("COMMIT");

    console.log(
      `[aggregation] processed ${lastProcessed.toISOString()} -> ${currentMinute.toISOString()}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[aggregation] failed:", error);
  } finally {
    client.release();
  }
}

export function startAggregationJob(): NodeJS.Timeout {
  void aggregateLogs();

  return setInterval(() => {
    void aggregateLogs();
  }, JOB_INTERVAL_MS);
}