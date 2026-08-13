import type { LogLevel } from '../types/logEntry.js';
import type { Cursor } from '../types/query.js';
import { decodeCursor } from '../query-builder/cursor.js';
import type { LogParams ,RawQuery } from '../types/query.js';
const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;


export type QueryValidationResult =
  | { valid: true; params: LogParams }
  | { valid: false; reason: string };

export function validateQueryParams(raw: RawQuery): QueryValidationResult {
  if (raw.level !== undefined && !VALID_LEVELS.includes(raw.level as LogLevel)) {
    return { valid: false, reason: `invalid level: '${raw.level}'` };
  }

  let since: Date | undefined;
  if (raw.since !== undefined) {
    since = new Date(raw.since);
    if (isNaN(since.getTime())) {
      return { valid: false, reason: `invalid timestamp for 'since': '${raw.since}'` };
    }
  }

  let until: Date | undefined;
  if (raw.until !== undefined) {
    until = new Date(raw.until);
    if (isNaN(until.getTime())) {
      return { valid: false, reason: `invalid timestamp for 'until': '${raw.until}'` };
    }
  }

  if (since && until && until.getTime() < since.getTime()) {
    return { valid: false, reason: "'until' must not be earlier than 'since'" };
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined) {
    const parsed = Number(raw.limit);
    if (!Number.isInteger(parsed) || String(parsed) !== raw.limit) {
      return { valid: false, reason: `limit must be a valid integer: '${raw.limit}'` };
    }
    if (parsed < 1 || parsed > MAX_LIMIT) {
      return { valid: false, reason: `limit must be between 1 and ${MAX_LIMIT}` };
    }
    limit = parsed;
  }

  let cursor: Cursor | undefined;
  if (raw.cursor !== undefined) {
    const decoded = decodeCursor(raw.cursor);
    if (decoded === null) {
      return { valid: false, reason: 'invalid or malformed cursor' };
    }
    cursor = decoded;
  }

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('attr.') && typeof value === 'string') {
      attributes[key.slice('attr.'.length)] = value;
    }
  }
  return {
    valid: true,
    params: {
      service: raw.service,
      level: raw.level as LogLevel | undefined,
      since,
      until,
      attributes,
      q: raw.q,
      limit,
      cursor,
    },
  };
}