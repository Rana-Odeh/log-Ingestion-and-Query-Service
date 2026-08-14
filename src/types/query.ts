import type { LogLevel } from './logEntry.js';

export interface LogFilters {
  service?: string;
  level?: LogLevel;
  attributes: Record<string, string>;
  q?: string;
}

export interface LogParams extends LogFilters {
  since?: Date;
  until?: Date;
  limit: number;
  cursor?: Cursor;
}
//***** 
export interface RawSharedFilters {
  service?: string;
  level?: string;
  q?: string;
  [key: `attr.${string}`]: string | undefined;
}

export  interface RawQuery extends RawSharedFilters {
  since?: string;
  until?: string;
  limit?: string;
  cursor?: string;
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