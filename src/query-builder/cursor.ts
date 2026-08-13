import type { Cursor } from '../types/query.js';

export function encodeCursor(payload: Cursor): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8').toString('base64');
}
export function decodeCursor(raw: string): Cursor | null {
  let json: string;
  try {
    json = Buffer.from(raw, 'base64').toString('utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Cursor).timestamp !== 'string' ||
    typeof (parsed as Cursor).id !== 'string'
  ) {
    return null;
  }
  const ts = new Date((parsed as Cursor).timestamp);
  if (isNaN(ts.getTime())) {
    return null;
  }
  return parsed as Cursor;
}


