import type { LogFilters } from './query.js';

export type BucketSize = '1m' | '5m' | '1h' | '1d';
export type GroupBy = 'service' | 'level';

export interface AggregateParams extends LogFilters {
  since: Date;
  until: Date;
  bucket: BucketSize;
  groupBy?: GroupBy;
}


export interface AggregateBucket {
  start: string;
  group: string | null;
  count: number;
}

export interface AggregateResponse {
  buckets: AggregateBucket[];
}