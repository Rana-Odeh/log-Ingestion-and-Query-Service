import type { RequestLogEntry, ValidatedLogEntry, LogAttributes, LogLevel } from '../types/logEntry.js';

const VALID_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const Five_Min = 5 * 60 * 1000;

export type ValidationResult = | { valid: true; entry: ValidatedLogEntry }| { valid: false; reason: string };

function validateTimestamp(raw: unknown): { valid: true; value: Date } | { valid: false; reason: string } 
{
  if (typeof raw !== 'string') {
    return { valid: false, reason: 'timestamp is required and must be a string' };
  }

  const date = new Date(raw);
  if (isNaN(date.getTime())) {
    return { valid: false, reason: `invalid timestamp: '${raw}'` };
  }

  if (date.getTime() > Date.now() + Five_Min) {
    return { valid: false, reason: 'timestamp is more than five minutes in the future' };
  }

  return { valid: true, value: date };
}

function validateLevel(raw: unknown): { valid: true; value: LogLevel } | { valid: false; reason: string } 
{
  if (typeof raw !== 'string' || !VALID_LEVELS.includes(raw as LogLevel)) {
    return { valid: false, reason: `invalid level: '${String(raw)}'` };
  }
  return { valid: true, value: raw as LogLevel };
}

function validateService(raw: unknown): { valid: true; value: string } | { valid: false; reason: string } 
{
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { valid: false, reason: 'service is required and must be a non-empty string' };
  }
  return { valid: true, value: raw };
}

function validateMessage(raw: unknown): { valid: true; value: string } | { valid: false; reason: string } {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { valid: false, reason: 'message is required and must be a non-empty string' };
  }
  return { valid: true, value: raw };
}

function validateAttributes(raw: unknown): { valid: true; value: LogAttributes } | { valid: false; reason: string } {
  if (raw === undefined) {
    return { valid: true, value: {} };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, reason: 'attributes must be a flat object' };
  }

  for (const [key, value] of Object.entries(raw)) {
    const type = typeof value;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      return { valid: false, reason: `attribute '${key}' must be a string, number, or boolean` };
    }
  }

  return { valid: true, value: raw as LogAttributes };
}

export function validateLogEntry(raw: RequestLogEntry): ValidationResult {
  const timestamp = validateTimestamp(raw.timestamp);
  if (!timestamp.valid) return { valid: false, reason: timestamp.reason };

  const level = validateLevel(raw.level);
  if (!level.valid) return { valid: false, reason: level.reason };

  const service = validateService(raw.service);
  if (!service.valid) return { valid: false, reason: service.reason };

  const message = validateMessage(raw.message);
  if (!message.valid) return { valid: false, reason: message.reason };

  const attributes = validateAttributes(raw.attributes);
  if (!attributes.valid) return { valid: false, reason: attributes.reason };

  return {
    valid: true,
    entry: {
      timestamp: timestamp.value,
      level: level.value,
      service: service.value,
      message: message.value,
      attributes: attributes.value,
    },
  };
}