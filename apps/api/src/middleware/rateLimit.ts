import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { env } from '../config/env.js';
import { sendStatusPage } from '../lib/http.js';

const WINDOW_MS = 60_000;
const MAX_PARTITIONS = 50_000;
const REDIS_SCRIPT =
  "local count = redis.call('INCR', KEYS[1]); " +
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; " +
  "return { count, redis.call('PTTL', KEYS[1]) }";

interface Bucket {
  windowStart: number;
  count: number;
}

interface AuthLike {
  userId: string | null;
}

const globalBuckets = new Map<string, Bucket>();
const editorialBuckets = new Map<string, Bucket>();

function bucketFor(map: Map<string, Bucket>, key: string): Bucket {
  const now = Date.now();
  const existing = map.get(key);
  if (existing !== undefined && now - existing.windowStart < WINDOW_MS) return existing;

  if (map.size >= MAX_PARTITIONS) {
    for (const [candidate, bucket] of map) {
      if (now - bucket.windowStart >= WINDOW_MS) map.delete(candidate);
    }
    if (map.size >= MAX_PARTITIONS) {
      const oldest = map.keys().next();
      if (!oldest.done) map.delete(oldest.value);
    }
  }

  const fresh = { windowStart: now, count: 0 };
  map.set(key, fresh);
  return fresh;
}

/** Client identity is resolved by Express's explicit trusted-proxy allowlist. */
export function clientIp(req: Request): string {
  const normalize = (value: string | undefined): string | null => {
    if (!value) return null;
    const candidate = value.toLowerCase().startsWith('::ffff:')
      ? value.slice('::ffff:'.length)
      : value;
    return isIP(candidate) !== 0 ? candidate.toLowerCase() : null;
  };

  try {
    const resolved = normalize(req.ip);
    if (resolved !== null) return resolved;
  } catch {
    // Malformed forwarded metadata falls back to the transport peer.
  }
  return normalize(req.socket.remoteAddress) ?? 'unknown';
}

function partitionKey(req: Request & { auth?: AuthLike }): string {
  return req.auth?.userId ? 'user:' + req.auth.userId : 'ip:' + clientIp(req);
}

function memoryIncrement(map: Map<string, Bucket>, key: string): number {
  const bucket = bucketFor(map, key);
  bucket.count += 1;
  return bucket.count;
}

/**
 * Upstash REST EVAL executes INCR + first-write PEXPIRE atomically on Redis.
 * The partition is hashed so user identifiers and IPs are not stored as keys.
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

  if (!response.ok) throw new Error('Shared rate-limit store returned HTTP ' + response.status + '.');
  const payload = (await response.json()) as { result?: unknown };
  if (!Array.isArray(payload.result) || !Number.isSafeInteger(Number(payload.result[0]))) {
    throw new Error('Shared rate-limit store returned an invalid counter response.');
  }
  return Number(payload.result[0]);
}

async function isAllowed(
  scope: string,
  req: Request & { auth?: AuthLike },
  memory: Map<string, Bucket>,
  limit: number,
): Promise<boolean> {
  const partition = partitionKey(req);
  const count =
    env.RATE_LIMIT_STORE === 'upstash'
      ? await incrementSharedRateLimit(scope, partition)
      : memoryIncrement(memory, partition);
  return count <= limit;
}

function reject(req: Request & { traceId?: string }, res: Response, status = 429): void {
  sendStatusPage(res, status, req.traceId ?? '0000000000000:00000000');
}

/**
 * Global limit is fail-open on a shared-store outage to preserve read/API
 * availability; editorial writes fail closed below. Monitor this log signal.
 */
export async function globalRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await isAllowed('global', req as Request & { auth?: AuthLike }, globalBuckets, env.RATE_LIMIT_GLOBAL_PER_MINUTE)) {
      next();
    } else {
      reject(req, res);
    }
  } catch (error) {
    console.error('Global rate-limit store unavailable; request allowed', error instanceof Error ? error.message : 'unknown error');
    next();
  }
}

/** Editorial writes fail closed when shared enforcement is unavailable. */
export async function editorialRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await isAllowed('editorial', req as Request & { auth?: AuthLike }, editorialBuckets, env.RATE_LIMIT_EDITORIAL_PER_MINUTE)) {
      next();
    } else {
      reject(req, res);
    }
  } catch (error) {
    console.error('Editorial rate-limit store unavailable; write rejected', error instanceof Error ? error.message : 'unknown error');
    reject(req, res, 503);
  }
}
