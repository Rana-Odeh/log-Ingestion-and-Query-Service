import { db } from '../db/client.js';
import { logs } from '../db/schema.js';
import { sql,and, desc, gte, lt} from 'drizzle-orm';
import type { LogParams, LogResponse, LogResponseItem } from '../types/query.js';
import { encodeCursor } from './cursor.js';
import {buildSharedConditions} from './sharedConditions.js';

export async function getLogs(params: LogParams): Promise<LogResponse> {
  const filters = buildSharedConditions(params);
  if (params.since) {
    filters.push(gte(logs.timestamp, params.since));
  }
  if (params.until) {
    filters.push(lt(logs.timestamp, params.until));
  }

  if (params.cursor) {
    filters.push(
      sql`(${logs.timestamp}, ${logs.id}) < (${params.cursor.timestamp}::timestamptz, ${params.cursor.id}::uuid)`
    );
  }
  const Search = filters.length > 0 ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(logs)
    .where(Search)
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(params.limit + 1);

  const hasNextPage = rows.length > params.limit;
  const pageRows = hasNextPage ? rows.slice(0, params.limit) : rows;

  const items: LogResponseItem[] = pageRows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    level: row.level,
    service: row.service,
    message: row.message,
    attributes: row.attributes,
  }));

  let nextCursor: string | null = null;
  if (hasNextPage) {
    const last = pageRows[pageRows.length - 1];
    nextCursor = encodeCursor({
      timestamp: last.timestamp.toISOString(),
      id: last.id,
    });
  }

  return { logs: items, next_cursor: nextCursor };
}