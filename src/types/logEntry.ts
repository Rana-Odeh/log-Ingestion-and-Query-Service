export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogAttributes = {
  [key: string]: string | number | boolean;
}

export type RequestLogEntry = {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes?: unknown;
}

export type ValidatedLogEntry =  {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  attributes: LogAttributes;
}

export type RejectedEntry = {
  index: number;
  reason: string;
}

export type IngestResult = {
  accepted: number;
  rejected: RejectedEntry[];
}
