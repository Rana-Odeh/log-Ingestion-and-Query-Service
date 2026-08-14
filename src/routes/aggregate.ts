import type { FastifyInstance } from 'fastify';
import { validateAggregateParams } from '../validation/aggregate.js';
import { getAggregate } from '../query-builder/aggregate.js';

export function registerAggregateRoute(fastify: FastifyInstance): void {
  fastify.get('/logs/aggregate', async function handler(request, reply) {
    const result = validateAggregateParams(request.query as Parameters<typeof validateAggregateParams>[0]);

    if (!result.valid) {
      return reply.code(400).send({ error: result.reason });
    }

    const response = await getAggregate(result.params);
    return reply.code(200).send(response);
  });
}