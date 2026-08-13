import type { LogLevel } from './logEntry.js';

export interface LogFilters {
  service?: string;
  level?: LogLevel;
  since?: Date;
  until?: Date;
  attributes: Record<string, string>;
  q?: string;
}

export interface LogParams extends LogFilters {
  limit: number;
  cursor?: Cursor;
}
export  interface RawQuery {
  service?: string;
  level?: string;
  since?: string;
  until?: string;
  q?: string;
  limit?: string;
  cursor?: string;
  [key: `attr.${string}`]: string | undefined;
}

export interface Cursor {
  timestamp: string;
  id: string;
}

export interface LogResponseItem{
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  attributes: Record<string, string | number | boolean>;
}

export interface LogResponse {
  logs: LogResponseItem[];
  next_cursor: string | null;
}