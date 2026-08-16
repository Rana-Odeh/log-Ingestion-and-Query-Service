import Fastify from 'fastify';
import { registerLogsRoutes } from './routes/logs.routes.js';

export function buildApp() {
  const fastify = Fastify({ logger: true });

  let isReady = false;

  fastify.get('/health', async function handler(_request, reply) {
    if (!isReady) {
      return reply.code(503).send({ status: 'not ready' });
    }

    return reply.code(200).send({ status: 'ok' });
  });

fastify.register(registerLogsRoutes);

  return {
    fastify,
    setReady: () => {
      isReady = true;
    },
  };
}