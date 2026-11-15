import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

const WINDOW_MS = 60_000;
const REDIS_SCRIPT =
  "local count = redis.call('INCR', KEYS[1]); " +
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; " +
  "return { count, redis.call('PTTL', KEYS[1]) }";

/**
 * Atomically increments a fixed-window counter in Upstash Redis.
 * The partition is SHA-256 hashed so user identifiers and client IPs are
 * never exposed in Redis key names.
 */
export async function incrementSharedRateLimit(scope: string, partition: string): Promise<number> {
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
    body: JSON.stringify(['EVAL', REDIS_SCRIPT, '1', key, String(WINDOW_MS)]),
    signal: AbortSignal.timeout(1_500),
  });

  if (!response.ok) {
    throw new Error('Shared rate-limit store returned HTTP ' + response.status + '.');
  }

  const payload = (await response.json()) as { result?: unknown };
  const rawCount = Array.isArray(payload.result) ? payload.result[0] : undefined;
  const count =
    typeof rawCount === 'number' || (typeof rawCount === 'string' && rawCount.trim() !== '')
      ? Number(rawCount)
      : Number.NaN;

  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('Shared rate-limit store returned an invalid counter response.');
  }

  return count;
}
