import type { Pool } from 'pg';
import { ensurePartitions } from '../db/partitions.js';

const INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startPartitionMaintenanceJob(
  pool: Pool,
): () => void {
  const timer = setInterval(() => {
    ensurePartitions(pool).catch((err) => {
      console.error('failed to ensure future partitions', err);
    });
  }, INTERVAL_MS);

  return () => clearInterval(timer);
}