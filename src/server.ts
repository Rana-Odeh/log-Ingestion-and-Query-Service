import { pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { ensurePartitions } from './db/partitions.js';
import { startPartitionMaintenanceJob } from './jobs/partitionMaintenance.js';
import { buildApp } from './app.js';
import { startRetentionJob } from './jobs/retentionCleanup.js';

const { fastify, setReady } = buildApp();
// import { startAggregationJob } from "./jobs/aggregateLogs.js";
async function start(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    await runMigrations(pool);
    await ensurePartitions(pool);

    const stopPartitionJob = startPartitionMaintenanceJob(pool);
    const stopRetentionJob = startRetentionJob(pool);
    //startAggregationJob();

    setReady();

    const port = Number(process.env.PORT ?? 8080);

    await fastify.listen({
      port,
      host: '0.0.0.0',
    });

   const shutdown = async () => {
    stopPartitionJob();
    stopRetentionJob();
    await fastify.close();
    await pool.end();

    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    fastify.log.error(err, 'startup failed');
    process.exit(1);
  }
}

start();