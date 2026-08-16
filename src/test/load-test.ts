import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.LOAD_TEST_URL ?? 'http://localhost:8080';
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 100);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const TARGET_ROWS = process.env.TARGET_ROWS ? Number(process.env.TARGET_ROWS) : undefined;
const DURATION_SEC = Number(process.env.DURATION_SEC ?? (TARGET_ROWS ? 600 : 15));

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

function buildBatch(size: number) {
  const logs = Array.from({ length: size }, randomLogEntry);
  return JSON.stringify({ logs });
}

async function sendBatch(): Promise<{ ok: boolean; accepted: number }> {
  const body = buildBatch(BATCH_SIZE);
  try {
    const res = await fetch(`${BASE_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) return { ok: false, accepted: 0 };
    const data = (await res.json()) as { accepted: number };
    return { ok: true, accepted: data.accepted };
  } catch {
    return { ok: false, accepted: 0 };
  }
}
async function worker(stopAt: number, stats: { totalAccepted: number; totalRequests: number; failed: number }) {
  while (performance.now() < stopAt) {
    if (TARGET_ROWS !== undefined && stats.totalAccepted >= TARGET_ROWS) {
      break;
    }
    const result = await sendBatch();
    stats.totalRequests++;
    if (result.ok) {
      stats.totalAccepted += result.accepted;
    } else {
      stats.failed++;
    }
  }
}

async function main() {
  console.log(`Load test: ${CONCURRENCY} concurrent workers, batch size ${BATCH_SIZE}, duration ${DURATION_SEC}s`);

  const stats = { totalAccepted: 0, totalRequests: 0, failed: 0 };
  const start = performance.now();
  const stopAt = start + DURATION_SEC * 1000;

  const workers = Array.from({ length: CONCURRENCY }, () => worker(stopAt, stats));
  await Promise.all(workers);

  const elapsedSec = (performance.now() - start) / 1000;
  const logsPerSec = stats.totalAccepted / elapsedSec;

  console.log('--- Results ---');
  console.log(`Elapsed: ${elapsedSec.toFixed(2)}s`);
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Failed requests: ${stats.failed}`);
  console.log(`Total logs accepted: ${stats.totalAccepted}`);
  console.log(`Logs/sec: ${logsPerSec.toFixed(0)}`);
}

main();