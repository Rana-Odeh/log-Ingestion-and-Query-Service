import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.LOAD_TEST_URL ?? 'http://localhost:8080';

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 100);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const DURATION_SEC = Number(process.env.DURATION_SEC ?? 30);

type RequestResult = {
  ok: boolean;
  accepted: number;
  status: number;
  latencyMs: number;
};

type Stats = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalAccepted: number;
  latencies: number[];
  statusCodes: Map<number, number>;
};

function validateConfig(): void {
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE <= 0) {
    throw new Error('BATCH_SIZE must be a positive integer');
  }

  if (!Number.isInteger(CONCURRENCY) || CONCURRENCY <= 0) {
    throw new Error('CONCURRENCY must be a positive integer');
  }

  if (!Number.isFinite(DURATION_SEC) || DURATION_SEC <= 0) {
    throw new Error('DURATION_SEC must be greater than 0');
  }
}

function randomLogEntry() {
  const levels = ['debug', 'info', 'warn', 'error'];
  const services = ['checkout', 'auth', 'payments', 'shipping'];

  return {
    timestamp: new Date().toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    service: services[Math.floor(Math.random() * services.length)],
    message: `test message ${Math.random().toString(36).slice(2)}`,
    attributes: {
      user_id: String(Math.floor(Math.random() * 10000)),
      region: 'eu-west',
    },
  };
}

function buildBatch(size: number): string {
  const logs = Array.from({ length: size }, randomLogEntry);

  return JSON.stringify({ logs });
}

async function sendBatch(): Promise<RequestResult> {
  const body = buildBatch(BATCH_SIZE);
  const start = performance.now();

  try {
    const res = await fetch(`${BASE_URL}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const latencyMs = performance.now() - start;

    let accepted = 0;

    try {
      const data = (await res.json()) as {
        accepted?: number;
      };

      accepted = data.accepted ?? 0;
    } catch {
      accepted = 0;
    }

    return {
      ok: res.ok,
      accepted,
      status: res.status,
      latencyMs,
    };
  } catch {
    return {
      ok: false,
      accepted: 0,
      status: 0,
      latencyMs: performance.now() - start,
    };
  }
}

async function worker(
  stopAt: number,
  stats: Stats,
): Promise<void> {
  while (performance.now() < stopAt) {
    const result = await sendBatch();

    stats.totalRequests++;

    stats.latencies.push(result.latencyMs);

    const currentStatusCount =
      stats.statusCodes.get(result.status) ?? 0;

    stats.statusCodes.set(
      result.status,
      currentStatusCount + 1,
    );

    if (result.ok) {
      stats.successfulRequests++;
      stats.totalAccepted += result.accepted;
    } else {
      stats.failedRequests++;
    }
  }
}

function percentile(
  values: number[],
  percentileValue: number,
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const index = Math.ceil(
    (percentileValue / 100) * sorted.length,
  ) - 1;

  return sorted[Math.max(0, index)];
}

function printResults(
  stats: Stats,
  elapsedSec: number,
): void {
  const generatedLogs =
    stats.totalRequests * BATCH_SIZE;

  const throughput =
    stats.totalAccepted / elapsedSec;

  const requestsPerSec =
    stats.totalRequests / elapsedSec;

  const successRate =
    stats.totalRequests === 0
      ? 0
      : (stats.successfulRequests / stats.totalRequests) * 100;

  console.log('\n--- Results ---');

  console.log(
    `Elapsed:              ${elapsedSec.toFixed(2)}s`,
  );

  console.log(
    `Total requests:       ${stats.totalRequests}`,
  );

  console.log(
    `Successful requests:  ${stats.successfulRequests}`,
  );

  console.log(
    `Failed requests:      ${stats.failedRequests}`,
  );

  console.log(
    `Success rate:         ${successRate.toFixed(2)}%`,
  );

  console.log(
    `Generated logs:       ${generatedLogs}`,
  );

  console.log(
    `Accepted logs:        ${stats.totalAccepted}`,
  );

  console.log(
    `Requests/sec:         ${requestsPerSec.toFixed(0)}`,
  );

  console.log(
    `Accepted logs/sec:    ${throughput.toFixed(0)}`,
  );

  console.log('\n--- Latency ---');

  console.log(
    `p50:                  ${percentile(stats.latencies, 50).toFixed(2)} ms`,
  );

  console.log(
    `p95:                  ${percentile(stats.latencies, 95).toFixed(2)} ms`,
  );

  console.log(
    `p99:                  ${percentile(stats.latencies, 99).toFixed(2)} ms`,
  );

  console.log('\n--- HTTP Status Codes ---');

  for (const [status, count] of stats.statusCodes) {
    console.log(`${status}:                  ${count}`);
  }
}

async function main(): Promise<void> {
  validateConfig();

  console.log('--- Load Test Configuration ---');

  console.log(`URL:                   ${BASE_URL}`);
  console.log(`Batch size:            ${BATCH_SIZE}`);
  console.log(`Concurrency:           ${CONCURRENCY}`);
  console.log(`Duration:              ${DURATION_SEC}s`);

  console.log('\nStarting load test...\n');

  const stats: Stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalAccepted: 0,
    latencies: [],
    statusCodes: new Map(),
  };

  const start = performance.now();
  const stopAt = start + DURATION_SEC * 1000;

  const workers = Array.from(
    { length: CONCURRENCY },
    () => worker(stopAt, stats),
  );

  await Promise.all(workers);

  const elapsedSec =
    (performance.now() - start) / 1000;

  printResults(stats, elapsedSec);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});