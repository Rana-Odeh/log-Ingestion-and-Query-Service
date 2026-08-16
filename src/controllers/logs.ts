import type { FastifyRequest, FastifyReply } from 'fastify';
import { ingestLogs } from '../services/logs.js';
import type { RequestLogEntry } from '../types/logEntry.js';
import { validateQueryParams } from '../validation/query.js';
import { queryLogs } from '../services/logs.js';
import { validateAggregateParams } from '../validation/aggregate.js';
import { queryAggregate } from '../services/logs.js';

type IngestRequestBody = {
  logs?: unknown;
};

export async function ingestLogsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const body = request.body as IngestRequestBody;

  if (!body || !Array.isArray(body.logs)) {
    await reply
      .code(400)
      .send({
        error: "request body must be an object with a 'logs' array",
      });

    return;
  }

  const result = await ingestLogs(body.logs as RequestLogEntry[]);

  if (result.accepted === 0) {
    await reply.code(400).send(result);
    return;
  }

  await reply.code(200).send(result);
}
export async function queryLogsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = validateQueryParams(
    request.query as Parameters<typeof validateQueryParams>[0],
  );

  if (!result.valid) {
    await reply.code(400).send({
      error: result.reason,
    });

    return;
  }

  const response = await queryLogs(result.params);

  await reply.code(200).send(response);
}
export async function aggregateLogsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = validateAggregateParams(
    request.query as Parameters<typeof validateAggregateParams>[0],
  );

  if (!result.valid) {
    await reply.code(400).send({
      error: result.reason,
    });

    return;
  }

  const response = await queryAggregate(result.params);

  await reply.code(200).send(response);
}