import { pgTable, pgEnum, uuid, timestamp, varchar, text, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const logLevelEnum = pgEnum('log_level', ['debug', 'info', 'warn', 'error']);

export const logs = pgTable('logs', {
  id: uuid('id').notNull().defaultRandom(),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull(),
  level: logLevelEnum('level').notNull(),
  service: varchar('service', { length: 255 }).notNull(),
  message: text('message').notNull(),
  attributes: jsonb('attributes').$type<Record<string, string | number | boolean>>().notNull().default({}),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.timestamp] }),
}));

export type LogRow = typeof logs.$inferSelect;
export type NewLogRow = typeof logs.$inferInsert;