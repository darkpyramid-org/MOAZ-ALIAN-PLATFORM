import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { sendStatusPage, traceOf } from '../lib/http.js';

interface RawBodyRequest extends Request { rawBody?: Buffer }
interface Bucket { startedAt: number; count: number }
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 50_000;
const ipBuckets = new Map<string, Bucket>();
const accountBuckets = new Map<string, Bucket>();

function consume(map: Map<string, Bucket>, key: string, limit: number, now: number): boolean {
  let bucket = map.get(key);
  if (bucket === undefined || now - bucket.startedAt >= WINDOW_MS) {
    if (map.size >= MAX_BUCKETS) {
      for (const [candidate, value] of map) {
        if (now - value.startedAt >= WINDOW_MS) map.delete(candidate);
      }
      if (map.size >= MAX_BUCKETS) {
        const oldest = map.keys().next();
        if (!oldest.done) map.delete(oldest.value);
      }
    }
    bucket = { startedAt: now, count: 0 };
    map.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function identifierOf(req: RawBodyRequest): string | null {
  if (!req.rawBody || req.rawBody.length === 0) return null;
  try {
    const body = JSON.parse(req.rawBody.toString('utf8')) as Record<string, unknown>;
    const emailEntry = Object.entries(body).find(([key]) => key.toLowerCase() === 'email')?.[1];
    const email = typeof emailEntry === 'string' ? emailEntry.trim().toLowerCase() : '';
    if (email !== '') return 'email:' + email;
    const tokenEntry = Object.entries(body).find(([key]) => key.toLowerCase() === 'token')?.[1];
    const token = typeof tokenEntry === 'string' ? tokenEntry : '';
    if (token !== '') return 'reset:' + token;
  } catch {
    // The JSON binder owns malformed-body responses; the IP budget still applies.
  }
  const authenticatedUserId = (req as Request & { auth?: { userId?: string | null } }).auth?.userId;
  return authenticatedUserId ? 'user:' + authenticatedUserId : null;
}

/**
 * Fixed-window protection for public credential endpoints. Use the direct
 * socket peer because Express proxy trust is disabled; ignore spoofable XFF.
 * Account identifiers are hashed so PII/reset tokens never enter map keys.
 */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const raw = req as RawBodyRequest;
  const ip = req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const identifier = identifierOf(raw);
  const ipAllowed = consume(ipBuckets, ip, env.AUTH_RATE_LIMIT_IP_PER_MINUTE, now);
  const accountHash = identifier === null ? null : createHash('sha256').update(identifier).digest('hex');
  const accountAllowed = accountHash === null || consume(accountBuckets, ip + ':' + accountHash, env.AUTH_RATE_LIMIT_ACCOUNT_PER_MINUTE, now);
  if (!ipAllowed || !accountAllowed) {
    sendStatusPage(res, 429, traceOf(req));
    return;
  }
  next();
}
