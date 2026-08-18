import type { Pool } from 'pg';

function partitionCutoffName(retentionDays: number): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return `logs_${cutoff.getUTCFullYear()}_${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}_${String(cutoff.getUTCDate()).padStart(2, '0')}`;
}

interface PartitionRow {
  partition_name: string;
}

export async function dropExpiredPartitions(pool: Pool, retentionDays: number): Promise<string[]> {
  const cutoffName = partitionCutoffName(retentionDays);

  const { rows } = await pool.query<PartitionRow>(
    `
    SELECT child.relname AS partition_name
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    WHERE parent.relname = 'logs'
      AND child.relname LIKE 'logs\\_2%'
      AND child.relname < $1
    `,
    [cutoffName]
  );

  const dropped: string[] = [];
  for (const row of rows) {
    await pool.query(`DROP TABLE IF EXISTS ${row.partition_name}`);
    dropped.push(row.partition_name);
  }

  return dropped;
}