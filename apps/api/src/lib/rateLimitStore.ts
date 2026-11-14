import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

const DEFAULT_WINDOW_MS = 60_000;
const MAX_LOCAL_PARTITIONS = 50_000;
const REDIS_SCRIPT =
  "local count = redis.call('INCR', KEYS[1]); " +
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; " +
  "return { count, redis.call('PTTL', KEYS[1]) }";

interface LocalBucket {
  windowStart: number;
  count: number;
}

const localCounters = new Map<string, LocalBucket>();

function incrementLocal(scope: string, partition: string, windowMs: number): number {
  const now = Date.now();
  const key = scope + ':' + createHash('sha256').update(partition).digest('hex');
  let bucket = localCounters.get(key);

  if (bucket === undefined || now - bucket.windowStart >= windowMs) {
    if (localCounters.size >= MAX_LOCAL_PARTITIONS) {
      for (const [candidate, value] of localCounters) {
        if (now - value.windowStart >= windowMs) localCounters.delete(candidate);
      }
      if (localCounters.size >= MAX_LOCAL_PARTITIONS) {
        const oldest = localCounters.keys().next();
        if (!oldest.done) localCounters.delete(oldest.value);
      }
    }
    bucket = { windowStart: now, count: 0 };
    localCounters.set(key, bucket);
  }

  bucket.count += 1;
  return bucket.count;
}

/**
 * Atomically increments a shared fixed-window counter. The key contains only
 * a digest of the partition so user identifiers and client IPs are not stored.
 */
export async function incrementSharedRateLimit(
  scope: string,
  partition: string,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<number> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Shared rate-limit store is not configured.');
  }

  const partitionHash = createHash('sha256').update(partition).digest('hex');
  const key = 'moaz:rate-limit:' + scope + ':' + partitionHash;
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', REDIS_SCRIPT, '1', key, String(windowMs)]),
    signal: AbortSignal.timeout(1_500),
  });

  if (!response.ok) throw new Error('Shared rate-limit store returned HTTP ' + response.status + '.');
  const payload = (await response.json()) as { result?: unknown };
  if (!Array.isArray(payload.result) || !Number.isSafeInteger(Number(payload.result[0]))) {
    throw new Error('Shared rate-limit store returned an invalid counter response.');
  }
  return Number(payload.result[0]);
}

/** Auxiliary security limits share the same Redis store in production. */
export async function incrementAuxiliaryRateLimit(
  scope: string,
  partition: string,
  windowMs: number,
): Promise<number> {
  if (env.RATE_LIMIT_STORE === 'upstash') {
    return incrementSharedRateLimit(scope, partition, windowMs);
  }
  return incrementLocal(scope, partition, windowMs);
}
