import type { Cursor } from '../types/query.js';
import { decodeCursor } from '../query-builder/cursor.js';
import type { LogParams ,RawQuery } from '../types/query.js';
import { validateSharedFilters } from './sharedFilters.js';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export type QueryValidationResult =
  | { valid: true; params: LogParams }
  | { valid: false; reason: string };

export function validateQueryParams(raw: RawQuery): QueryValidationResult {
  const shared = validateSharedFilters(raw);
  if (!shared.valid) return shared;

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

  let cursor: Cursor| undefined;
  if (raw.cursor !== undefined) {
    const decoded = decodeCursor(raw.cursor);
    if (decoded === null) {
      return { valid: false, reason: 'invalid or malformed cursor' };
    }
    cursor = decoded;
  }

  return {
    valid: true,
    params: { ...shared.filters, since, until, limit, cursor },
  };
}