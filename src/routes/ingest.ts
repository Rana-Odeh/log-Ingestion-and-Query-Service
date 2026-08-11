import type { FastifyInstance } from 'fastify';
import { validateLogEntry } from '../validation/logEntry.js';
import { insertValidatedEntries } from '../db/queries/insertLogs.js';
import type { RequestLogEntry, RejectedEntry, ValidatedLogEntry } from '../types/logEntry.js';

type IngestRequestBody = {
  logs?: unknown;
}

export function registerIngestRoute(fastify: FastifyInstance): void {
  fastify.post ('/logs', async function handler (request, reply) {
    const body = request.body as IngestRequestBody;

    if (!body || !Array.isArray(body.logs)) {
      return reply.code(400).send({ error: "request body must be an object with a 'logs' array" });
    }

    const rawEntries = body.logs as RequestLogEntry[];
    const validEntries: ValidatedLogEntry[] = [];
    const rejected: RejectedEntry[] = [];

    rawEntries.forEach((raw, index) => {
      const result = validateLogEntry(raw);
      if (result.valid) {
        validEntries.push(result.entry);
      } else {
        rejected.push({ index, reason: result.reason });
      }
    });

    if (validEntries.length === 0) {
      return reply.code(400).send({ accepted: 0, rejected });
    }

    await insertValidatedEntries(validEntries);

    return reply.code(200).send({ accepted: validEntries.length, rejected });
  
});
}