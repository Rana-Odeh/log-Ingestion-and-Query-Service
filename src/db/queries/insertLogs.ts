import { db } from '../client.js';
import { logs } from '../schema.js';
import type { ValidatedLogEntry } from '../../types/logEntry.js';

export async function insertValidatedEntries(entries: ValidatedLogEntry[]): Promise<void> {
  for (const entry of entries) {
    await db.insert(logs).values({
      timestamp: entry.timestamp,
      level: entry.level,
      service: entry.service,
      message: entry.message,
      attributes: entry.attributes,
    });
  }
}