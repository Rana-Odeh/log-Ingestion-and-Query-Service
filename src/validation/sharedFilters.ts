import type { LogLevel } from '../types/logEntry.js';
import type { LogFilters,RawSharedFilters } from '../types/query.js';
const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export type SharedFiltersResult =
  | { valid: true; filters: LogFilters }
  | { valid: false; reason: string };

export function validateSharedFilters(raw: RawSharedFilters): SharedFiltersResult {
  if (raw.level !== undefined && !VALID_LEVELS.includes(raw.level as LogLevel)) {
    return { valid: false, reason: `invalid level: '${raw.level}'` };
  }

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('attr.') && typeof value === 'string') {
      attributes[key.slice('attr.'.length)] = value;
    }
  }

  return {
    valid: true,
    filters: {
      service: raw.service,
      level: raw.level as LogLevel | undefined,
      attributes,
      q: raw.q,
    },
  };
}