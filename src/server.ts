import Fastify from 'fastify';
import { pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { ensurePartitions } from './db/partitions.js';
import { registerIngestRoute } from './routes/ingest.js';
let isReady = false;
const fastify = Fastify({ logger: true });

fastify.get('/health', async function handler (_request, reply) {
  if (!isReady) {
    return reply.code(503).send({ status: 'not ready' });
  }
  return reply.code(200).send({ status: 'ok' });
});

async function start(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    await runMigrations(pool);
    await ensurePartitions(pool);

    isReady = true;

    setInterval(() => {
      ensurePartitions(pool).catch((err) => {
        fastify.log.error(err, 'failed to ensure future partitions');
      });
    }, 6 * 60 * 60 * 1000);
    fastify.register(registerIngestRoute);

    const port = Number(process.env.PORT ?? 8080);
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err, 'startup failed');
    process.exit(1);
  }
}

start();
