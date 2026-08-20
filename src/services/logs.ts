import { validateLogEntry } from '../validation/logEntry.js';
import type {
  RequestLogEntry,
  RejectedEntry,
  ValidatedLogEntry,
  IngestResult,
} from '../types/logEntry.js';
import { encodeCursor } from '../utils/cursor.js';
import type {
  LogParams,
  LogResponse,
  LogResponseItem,
} from '../types/query.js';  
import type {
  AggregateParams,
  AggregateResponse,
} from '../types/aggregate.js';
import { findLogs, aggregateLogs ,insertLogs} from '../repositories/logs.js';

export async function ingestLogs(
  rawEntries: RequestLogEntry[],
): Promise<IngestResult> {
  const validEntries: ValidatedLogEntry[] = [];
  const rejected: RejectedEntry[] = [];

  rawEntries.forEach((raw, index) => {
    const result = validateLogEntry(raw);

    if (result.valid) {
      validEntries.push(result.entry);
    } else {
      rejected.push({
        index,
        reason: result.reason,
      });
    }
  });

  if (validEntries.length > 0) {
    await insertLogs(validEntries);
  }

  return {
    accepted: validEntries.length,
    rejected,
  };
}
export async function queryLogs(
  params: LogParams,
): Promise<LogResponse> {
  const rows = await findLogs(params);

  const hasNextPage = rows.length > params.limit;

  const pageRows = hasNextPage
    ? rows.slice(0, params.limit)
    : rows;

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

  return {
    logs: items,
    next_cursor: nextCursor,
  };
}
export async function queryAggregate(
  params: AggregateParams,
): Promise<AggregateResponse> {
  const result = await aggregateLogs(params);

  const buckets = (
    result.rows as Array<{
      bucket_start: Date;
      grp: string | null;
      count: number;
    }>
  ).map((row) => ({
    start: new Date(row.bucket_start).toISOString(),
    group: row.grp,
    count: row.count,
  }));

  return {
    buckets,
  };
}