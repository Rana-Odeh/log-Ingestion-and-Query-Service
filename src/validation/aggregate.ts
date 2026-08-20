import type { AggregateParams,RawAggregateQuery, BucketSize, GroupBy } from '../types/aggregate.js';
import { validateSharedFilters} from './sharedFilters.js';

const VALID_BUCKETS: BucketSize[] = ['1m', '5m', '1h', '1d'];
const VALID_GROUP_BY: GroupBy[] = ['service', 'level'];



export type AggregateValidationResult =
  | { valid: true; params: AggregateParams }
  | { valid: false; reason: string };

export function validateAggregateParams(raw: RawAggregateQuery): AggregateValidationResult {
  const shared = validateSharedFilters(raw);
  if (!shared.valid) return shared;

  if (raw.since === undefined) {
    return { valid: false, reason: "'since' is required" };
  }
  const since = new Date(raw.since);
  if (isNaN(since.getTime())) {
    return { valid: false, reason: `invalid timestamp for 'since': '${raw.since}'` };
  }

  if (raw.until === undefined) {
    return { valid: false, reason: "'until' is required" };
  }
  const until = new Date(raw.until);
  if (isNaN(until.getTime())) {
    return { valid: false, reason: `invalid timestamp for 'until': '${raw.until}'` };
  }

  if (until.getTime() <= since.getTime()) {
  return { valid: false, reason: "'until' must be later than 'since'" };
  }
  if (raw.bucket === undefined) {
    return { valid: false, reason: "'bucket' is required" };
  }
  if (!VALID_BUCKETS.includes(raw.bucket as BucketSize)) {
    return { valid: false, reason: `invalid bucket: '${raw.bucket}'. must be one of 1m, 5m, 1h, 1d` };
  }

  let groupBy: GroupBy | undefined;
  if (raw.group_by !== undefined) {
    if (!VALID_GROUP_BY.includes(raw.group_by as GroupBy)) {
      return { valid: false, reason: `invalid group_by: '${raw.group_by}'. must be 'service' or 'level'` };
    }
    groupBy = raw.group_by as GroupBy;
  }

  return {
    valid: true,
    params: { ...shared.filters, since, until, bucket: raw.bucket as BucketSize, groupBy },
  };
}