import type { Pool } from 'pg';

function partitionNameForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `logs_${year}_${month}_${day}`;
}

async function createPartitionIfNotExists(pool: Pool, date: Date): Promise<void> {
  const partitionName = partitionNameForDate(date);

  const rangeStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const startLiteral = rangeStart.toISOString();
  const endLiteral = rangeEnd.toISOString();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${partitionName}
    PARTITION OF logs
    FOR VALUES FROM ('${startLiteral}') TO ('${endLiteral}');
  `);
}
export async function ensurePartitions(pool: Pool, daysAhead = 3): Promise<void> {
  const today = new Date();

  for (let i = 0; i <= daysAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setUTCDate(today.getUTCDate() + i);
    await createPartitionIfNotExists(pool, targetDate);
  }
}
