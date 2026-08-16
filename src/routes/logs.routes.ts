import type { FastifyInstance } from 'fastify';
import {
  ingestLogsController,
  queryLogsController,
  aggregateLogsController,
} from '../controllers/logs.js';

export function registerLogsRoutes(
  fastify: FastifyInstance,
): void {
  fastify.post('/logs', ingestLogsController);
  fastify.get('/logs', queryLogsController);
  fastify.get('/logs/aggregate', aggregateLogsController);
}