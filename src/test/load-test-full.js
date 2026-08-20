import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const TEST_DURATION = __ENV.DURATION || '120s';

// Your project's target: 15,000 logs/sec
const TARGET_LOGS_PER_SEC = Number(__ENV.TARGET_LOGS_PER_SEC || 15000);

// Batch size sent to POST /logs
const BATCH_SIZE = Number(__ENV.BATCH_SIZE || 100);

// Number of batches/sec needed to reach the target
const INGEST_RATE = Math.ceil(TARGET_LOGS_PER_SEC / BATCH_SIZE);

export const ingest_success_rate = new Rate('ingest_success_rate');
export const logs_ingested = new Counter('logs_ingested');

export const aggregate_latency = new Trend('aggregate_latency_ms', true);
export const aggregate_success_rate = new Rate('aggregate_success_rate');

export const freshness_seconds = new Trend('freshness_seconds', true);
export const freshness_success_rate = new Rate('freshness_success_rate');
export const freshness_timeouts = new Counter('freshness_timeouts');

export const options = {
  scenarios: {
    ingestion: {
      executor: 'constant-arrival-rate',

      // Example:
      // 15000 logs/sec / 100 logs per batch = 150 requests/sec
      rate: INGEST_RATE,
      timeUnit: '1s',

      duration: TEST_DURATION,

      preAllocatedVUs: 200,
      maxVUs: 500,

      exec: 'ingest',
    },

    aggregate: {
      executor: 'constant-arrival-rate',

      // One aggregation query every second
      rate: 1,
      timeUnit: '1s',

      duration: TEST_DURATION,

      preAllocatedVUs: 5,
      maxVUs: 10,

      exec: 'aggregateProbe',

      startTime: '5s',
    },

    freshness: {
      executor: 'constant-vus',

      vus: 1,
      duration: TEST_DURATION,

      exec: 'freshnessProbe',

      startTime: '2s',
    },
  },

  thresholds: {
    // Ingestion requests should almost always succeed
    ingest_success_rate: ['rate>0.99'],

    // Aggregation should normally finish within 1 second
    aggregate_latency_ms: ['p(95)<1000'],

    // Newly inserted logs should become queryable within 20 seconds
    freshness_seconds: ['p(95)<20'],

    freshness_success_rate: ['rate>0.99'],
  },
};

const LEVELS = ['debug', 'info', 'warn', 'error'];

const SERVICES = [
  'checkout',
  'auth',
  'payment',
  'inventory',
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomLog(extraAttributes = {}) {
  return {
    timestamp: new Date().toISOString(),

    level: randomItem(LEVELS),

    service: randomItem(SERVICES),

    message: `load-test log ${Math.random()}`,

    attributes: {
      user_id: String(Math.floor(Math.random() * 10000)),
      request_id: `req_${Math.random().toString(36).slice(2)}`,
      region: randomItem([
        'eu-west',
        'us-east',
        'ap-south',
      ]),

      ...extraAttributes,
    },
  };
}

/**
 * Ingestion
 *
 * Target:
 *   TARGET_LOGS_PER_SEC
 *
 * With defaults:
 *   15,000 logs/sec
 *   100 logs/request
 *   150 POST requests/sec
 */
export function ingest() {
  const logs = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    logs.push(randomLog());
  }

  const response = http.post(
    `${BASE_URL}/logs`,
    JSON.stringify({ logs }),
    {
      headers: {
        'Content-Type': 'application/json',
      },

      tags: {
        name: 'ingest',
      },

      timeout: '10s',
    }
  );

  const success = response.status === 200;

  ingest_success_rate.add(success);

  check(response, {
    'POST /logs returns 200': (r) => r.status === 200,
  });

  if (success) {
    try {
      const body = JSON.parse(response.body);

      // Your API should return the number of accepted logs.
      if (typeof body.accepted === 'number') {
        logs_ingested.add(body.accepted);
      } else {
        // If the API doesn't return accepted,
        // count the batch size as successfully submitted.
        logs_ingested.add(BATCH_SIZE);
      }
    } catch {
      // HTTP 200 already counted as successful ingestion.
      logs_ingested.add(BATCH_SIZE);
    }
  }
}


/**
 * Aggregation probe
 *
 * Tests:
 *   GET /logs/aggregate
 *
 * Required project parameters:
 *   since
 *   until
 *   bucket
 *
 * Optional:
 *   group_by
 */
export function aggregateProbe() {
  const until = new Date();

  const since = new Date(
    until.getTime() - 10 * 60 * 1000
  );

  const url =
    `${BASE_URL}/logs/aggregate` +
    `?since=${encodeURIComponent(since.toISOString())}` +
    `&until=${encodeURIComponent(until.toISOString())}` +
    `&bucket=1m`;

  const response = http.get(url, {
    tags: {
      name: 'aggregate',
    },

    timeout: '10s',
  });

  const success = response.status === 200;

  aggregate_success_rate.add(success);

  aggregate_latency.add(response.timings.duration);

  check(response, {
    'GET /logs/aggregate returns 200': (r) =>
      r.status === 200,

    'aggregate response is valid JSON': (r) => {
      if (r.status !== 200) return false;

      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}


/**
 * Freshness probe
 *
 * Inserts one unique log and repeatedly queries it.
 *
 * Requirement:
 *   newly inserted logs should become queryable
 *   within 20 seconds.
 */
export function freshnessProbe() {
  const marker =
    `probe_${__VU}_${Date.now()}_${Math.floor(
      Math.random() * 1_000_000
    )}`;

  const log = randomLog({
    probe_id: marker,
  });

  const insertStart = Date.now();

  const postResponse = http.post(
    `${BASE_URL}/logs`,
    JSON.stringify({
      logs: [log],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },

      tags: {
        name: 'freshness_ingest',
      },

      timeout: '10s',
    }
  );

  if (postResponse.status !== 200) {
    freshness_success_rate.add(false);
    freshness_timeouts.add(1);
    freshness_seconds.add(20);

    sleep(2);
    return;
  }

  const deadline = insertStart + 20_000;

  let found = false;

  while (Date.now() < deadline) {
    /*
     * Your project supports attribute filtering.
     *
     * Current expected format:
     *   ?attr.probe_id=<value>
     */
    const url =
      `${BASE_URL}/logs` +
      `?attr.probe_id=${encodeURIComponent(marker)}` +
      `&limit=1`;

    const response = http.get(url, {
      tags: {
        name: 'freshness_poll',
      },

      timeout: '5s',
    });

    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);

        if (
          body.logs &&
          Array.isArray(body.logs) &&
          body.logs.length > 0
        ) {
          found = true;

          const freshness =
            (Date.now() - insertStart) / 1000;

          freshness_seconds.add(freshness);
          freshness_success_rate.add(true);

          break;
        }
      } catch {
        // Continue polling
      }
    }

    sleep(0.5);
  }

  if (!found) {
    freshness_success_rate.add(false);
    freshness_timeouts.add(1);
    freshness_seconds.add(20);
  }

  sleep(1);
}