import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { sendStatusPage } from '../lib/http.js';

/**
 * Fixed-window rate limiting — ports the ASP.NET RateLimiter (300/min global,
 * 30/min on the six editorial write endpoints) with the DOCUMENTED intent
 * rather than the .NET wiring artifact:
 *
 * The original runs UseRateLimiter *before* UseAuthentication, so the global
 * partition key could never see an authenticated user and editorial traffic
 * collapsed into one literal "anon" bucket. Here the limiter runs after token
 * parsing, so the key is the user id when a valid token is presented and the
 * client IP otherwise — what the original's comments always promised. The
 * 429 itself is unchanged: same status-page body, no Retry-After (the .NET
 * FixedWindowLimiter with QueueLimit=0 never sent one).
 *
 * Windows are per-partition and start at the first request, exactly like
 * FixedWindowRateLimiter; a rejected request still consumes nothing and the
 * window is not extended (fixed semantics, unlike sliding).
 */

const WINDOW_MS = 60_000;

interface Bucket {
  windowStart: number;
  count: number;
}

const globalBuckets = new Map<string, Bucket>();
const editorialBuckets = new Map<string, Bucket>();

// Bound the partition table: rate-limit keys are attacker-controlled (IPs,
// user ids), so an unbounded map is a memory leak with a 429 attached.
const MAX_PARTITIONS = 50_000;

function bucketFor(map: Map<string, Bucket>, key: string): Bucket {
  const now = Date.now();
  const existing = map.get(key);
  if (existing !== undefined && now - existing.windowStart < WINDOW_MS) {
    return existing;
  }
  if (map.size >= MAX_PARTITIONS) {
    // Cheap sweep first (expired windows), then drop the oldest insertion to
    // guarantee termination — Map preserves insertion order.
    for (const [k, b] of map) {
      if (now - b.windowStart >= WINDOW_MS) map.delete(k);
    }
    if (map.size >= MAX_PARTITIONS) {
      const oldest = map.keys().next();
      if (!oldest.done) map.delete(oldest.value);
    }
  }
  const fresh: Bucket = { windowStart: now, count: 0 };
  map.set(key, fresh);
  return fresh;
}

/**
 * Client IP for anonymous partitioning. The original trusted X-Forwarded-For
 * only from loopback proxies; per deployment the reverse proxy is expected to
 * set (or strip) the header — documented in the migration notes.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    const first = (forwarded.split(',')[0] ?? '').trim();
    if (first !== '') return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function partitionKey(req: Request & { auth?: AuthLike }): string {
  if (req.auth?.userId) {
    return `user:${req.auth.userId}`;
  }
  return `ip:${clientIp(req)}`;
}

interface AuthLike {
  userId: string | null;
}

function enforce(
  req: Request & { auth?: AuthLike; traceId?: string },
  res: Response,
  map: Map<string, Bucket>,
  permitLimit: number,
): boolean {
  const key = partitionKey(req);
  const bucket = bucketFor(map, key);
  bucket.count += 1;
  if (bucket.count > permitLimit) {
    // .NET's rejection: the status code alone; UseStatusCodePages rendered the
    // body. Reproduced directly — same bytes, no Retry-After.
    sendStatusPage(res, 429, req.traceId ?? '0000000000000:00000000');
    return false;
  }
  return true;
}

/** Global 300/min budget, applied to every request (after CORS preflight short-circuit). */
export function globalRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (enforce(req as never, res, globalBuckets, env.RATE_LIMIT_GLOBAL_PER_MINUTE)) {
    next();
  }
}

/** Tighter 30/min bucket for the six editorial write endpoints. */
export function editorialRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (enforce(req as never, res, editorialBuckets, env.RATE_LIMIT_EDITORIAL_PER_MINUTE)) {
    next();
  }
}
