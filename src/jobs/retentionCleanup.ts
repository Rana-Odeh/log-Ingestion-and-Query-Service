import type { Pool } from 'pg';
import { dropExpiredPartitions } from '../utils/retention.js';

const DEFAULT_RETENTION_DAYS = 30;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

function getRetentionDays(): number {
  const raw = process.env.RETENTION_DAYS;
  if (raw === undefined) return DEFAULT_RETENTION_DAYS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`invalid RETENTION_DAYS '${raw}', falling back to default (${DEFAULT_RETENTION_DAYS})`);
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

export function startRetentionJob(pool: Pool): () => void {
  const retentionDays = getRetentionDays();

  const run = () => {
    dropExpiredPartitions(pool, retentionDays)
      .then((dropped) => {
        if (dropped.length > 0) {
          console.log(`[retention] dropped ${dropped.length} expired partition(s): ${dropped.join(', ')}`);
        }
      })
      .catch((err) => {
        console.error('[retention] failed to drop expired partitions', err);
      });
  };

  run();

  const timer = setInterval(run, INTERVAL_MS);
  return () => clearInterval(timer);
}