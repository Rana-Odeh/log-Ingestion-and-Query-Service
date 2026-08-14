import { eq, sql, type SQL } from 'drizzle-orm';
import { logs } from '../db/schema.js';
import type { LogFilters } from '../types/query.js';

export function buildSharedConditions(filters: LogFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.service) {
    conditions.push(eq(logs.service, filters.service));
  }
  if (filters.level) {
    conditions.push(eq(logs.level, filters.level));
  }
  for (const [key, value] of Object.entries(filters.attributes)) {
    conditions.push(sql`${logs.attributes} ->> ${key} = ${value}`);
  }
  if (filters.q) {
    conditions.push(sql`${logs.message} ILIKE ${'%' + filters.q + '%'}`);
  }

  return conditions;
}