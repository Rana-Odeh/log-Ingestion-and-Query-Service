import type { FastifyInstance } from 'fastify';
import { getLogs } from '../query-builder/Logs.js';
import { validateQueryParams } from '../validation/query.js';

export function registerQueryRoute(fastify: FastifyInstance): void {
  fastify.get('/logs', async function handler(request, reply) {
    const result = validateQueryParams(request.query as Parameters<typeof validateQueryParams>[0]);

    if (!result.valid) {
      return reply.code(400).send({ error: result.reason });
    }

    const response = await getLogs(result.params);
    return reply.code(200).send(response);
  });
}