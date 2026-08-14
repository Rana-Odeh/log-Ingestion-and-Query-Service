import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { AggregateParams, AggregateResponse, BucketSize } from '../types/aggregate.js';
import {buildSharedConditions} from './sharedConditions.js';

const BUCKET_INTERVALS: Record<BucketSize, string> = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '1h': '1 hour',
  '1d': '1 day',
};

export async function getAggregate(params: AggregateParams): Promise<AggregateResponse> {
 const filters = buildSharedConditions(params);

  filters.push(sql`"timestamp" >= ${params.since.toISOString()}::timestamptz`);
  filters.push(sql`"timestamp" < ${params.until.toISOString()}::timestamptz`);

  const whereClause = sql.join(filters, sql` AND `);
  const interval = BUCKET_INTERVALS[params.bucket];

  const groupColumn =
    params.groupBy === 'service' ? sql`service` : params.groupBy === 'level' ? sql`level` : sql`NULL`;

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

  const result = await db.execute(query);

  const buckets = (result.rows as Array<{ bucket_start: Date; grp: string | null; count: number }>).map((row) => ({
    start: new Date(row.bucket_start).toISOString(),
    group: row.grp,
    count: row.count,
  }));

  return { buckets };
}