import Fastify from 'fastify';
import { registerLogsRoutes } from './routes/logs.routes.js';
import { pool } from './db/client.js';

export function buildApp() {
  const fastify = Fastify({ logger: true });

  let isReady = false;

  fastify.get('/health', async function handler(_request, reply) {
    if (!isReady) {
      return reply.code(503).send({ status: 'not ready' });
    }

    try {
      await pool.query('SELECT 1');

      return reply.code(200).send({ status: 'ok' });
    } catch (error) {
      fastify.log.error(error, 'Database health check failed');

      return reply.code(503).send({
        status: 'not ready',
        reason: 'database unavailable',
      });
    }
  });

  fastify.register(registerLogsRoutes);

  return {
    fastify,
    setReady: () => {
      isReady = true;
    },
  };
}