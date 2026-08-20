import { pool } from '../db/client.js';
import type { ValidatedLogEntry } from '../types/logEntry.js';
import { db } from '../db/client.js';
import { logs } from '../db/schema.js';
import { sql, and, desc, gte, lt } from 'drizzle-orm';
import type { LogParams } from '../types/query.js';
import { buildSharedConditions } from './logsConditions.js';


import type {
  AggregateParams,
} from '../types/aggregate.js';
const BUCKET_INTERVALS: Record<AggregateParams['bucket'], string> = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '1h': '1 hour',
  '1d': '1 day',
};

export async function insertLogs(
  entries: ValidatedLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const timestamps = entries.map((e) => e.timestamp.toISOString());
  const levels = entries.map((e) => e.level);
  const services = entries.map((e) => e.service);
  const messages = entries.map((e) => e.message);
  const attributes = entries.map((e) => JSON.stringify(e.attributes));

  await pool.query(
    `
    INSERT INTO logs (timestamp, level, service, message, attributes)
    SELECT
      t.timestamp::timestamptz,
      t.level::log_level,
      t.service,
      t.message,
      t.attributes::jsonb
    FROM UNNEST(
      $1::text[],
      $2::text[],
      $3::text[],
      $4::text[],
      $5::text[]
    ) AS t(timestamp, level, service, message, attributes)
    `,
    [timestamps, levels, services, messages, attributes],
  );
   //await upsertRollups(pool, entries);
}
export async function findLogs(params: LogParams) {
  const filters = buildSharedConditions(params);

  if (params.since) {
    filters.push(gte(logs.timestamp, params.since));
  }

  if (params.until) {
    filters.push(lt(logs.timestamp, params.until));
  }

  if (params.cursor) {
    filters.push(
      sql`(${logs.timestamp}, ${logs.id}) < (
        ${params.cursor.timestamp}::timestamptz,
        ${params.cursor.id}::uuid
      )`,
    );
  }

  const whereClause =
    filters.length > 0 ? and(...filters) : undefined;

  return db
    .select()
    .from(logs)
    .where(whereClause)
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(params.limit + 1);
}
// export async function aggregateLogs(params: AggregateParams) {
//   const filters = buildSharedConditions(params);

//   filters.push(
//     sql`"timestamp" >= ${params.since.toISOString()}::timestamptz`,
//   );

//   filters.push(
//     sql`"timestamp" < ${params.until.toISOString()}::timestamptz`,
//   );

//   const whereClause = sql.join(filters, sql` AND `);

//   const interval = BUCKET_INTERVALS[params.bucket];

//   const groupColumn =
//     params.groupBy === 'service'
//       ? sql`service`
//       : params.groupBy === 'level'
//         ? sql`level`
//         : sql`NULL`;

//   const query = sql`
//     SELECT
//       date_bin(
//         ${interval}::interval,
//         "timestamp",
//         TIMESTAMPTZ '2000-01-01'
//       ) AS bucket_start,
//       ${groupColumn} AS grp,
//       COUNT(*)::int AS count
//     FROM logs
//     WHERE ${whereClause}
//     GROUP BY bucket_start, grp
//     ORDER BY bucket_start ASC
//   `;

//   return db.execute(query);
// }
export async function aggregateLogs(params: AggregateParams) {
  const canUseRollup =
    (params.bucket === '1h' || params.bucket === '1d') &&
    Object.keys(params.attributes).length === 0 &&
    !params.q;

  if (canUseRollup) {
    return aggregateFromRollup(params);
  }

  return aggregateFromRawTable(params);
}

async function aggregateFromRollup(params: AggregateParams) {
  const truncUnit = params.bucket === '1d' ? 'day' : 'hour';

  const filters = [
    sql`bucket_start >= ${params.since.toISOString()}::timestamptz`,
    sql`bucket_start < ${params.until.toISOString()}::timestamptz`,
  ];

  if (params.service) {
    filters.push(sql`service = ${params.service}`);
  }
  if (params.level) {
    filters.push(sql`level = ${params.level}`);
  }

  const whereClause = sql.join(filters, sql` AND `);

  const groupColumn =
    params.groupBy === 'service'
      ? sql`service`
      : params.groupBy === 'level'
        ? sql`level`
        : sql`NULL`;

  const query = sql`
    SELECT
      date_trunc(${truncUnit}, bucket_start) AS bucket_start,
      ${groupColumn} AS grp,
      SUM(count)::int AS count
    FROM logs_rollup_hourly
    WHERE ${whereClause}
    GROUP BY 1, 2
    ORDER BY bucket_start ASC
  `;

  return db.execute(query);
}

async function aggregateFromRawTable(params: AggregateParams) {
  const filters = buildSharedConditions(params);

  filters.push(sql`"timestamp" >= ${params.since.toISOString()}::timestamptz`);
  filters.push(sql`"timestamp" < ${params.until.toISOString()}::timestamptz`);

  const whereClause = sql.join(filters, sql` AND `);
  const interval = BUCKET_INTERVALS[params.bucket];

  const groupColumn =
    params.groupBy === 'service'
      ? sql`service`
      : params.groupBy === 'level'
        ? sql`level`
        : sql`NULL`;

  const query = sql`
    SELECT
      date_bin(${interval}::interval, "timestamp", TIMESTAMPTZ '2000-01-01') AS bucket_start,
      ${groupColumn} AS grp,
      COUNT(*)::int AS count
    FROM logs
    WHERE ${whereClause}
    GROUP BY bucket_start, grp
    ORDER BY bucket_start ASC
  `;

  return db.execute(query);
}


