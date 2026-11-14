import type { NextFunction, Request, Response } from 'express';
import onHeaders from 'on-headers';
import { env } from '../config/env.js';

/**
 * CORS — a faithful port of the ASP.NET CorsMiddleware with the "frontend"
 * policy (Program.cs): configured origins (or the Vercel/dev fallbacks),
 * explicit method list, any header, no credentials (the token rides in the
 * Authorization header, never a cookie — CSRF stays inert by construction).
 *
 * Wire quirks reproduced from the golden captures:
 *   - preflight answers 204 and carries the fixed method list with NO spaces
 *     ("GET,POST,PUT,DELETE,OPTIONS"); requested headers are echoed back
 *     trimmed and comma-joined; there is no Max-Age (the policy never sets one);
 *   - an unallowed METHOD still gets the full header set (the CORS layer does
 *     not arbitrate routing) — only an unallowed ORIGIN is refused, and then
 *     with a bare 204 and no CORS headers at all;
 *   - on real (non-preflight) requests the origin header is added when allowed,
 *     and "Vary: Origin" rides along so caches never serve one origin another
 *     origin's response. Disallowed origins get no headers and pass through —
 *     the request itself still runs (the JWT is the real boundary).
 */

const ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';

function originAllowed(origin: string): boolean {
  // Explicit allowlist first, then the same fallback chain as Program.cs:
  // Vercel platform hosts when enabled, any localhost in development.
  if (env.allowedOrigins.includes(origin)) {
    return true;
  }

  if (env.CORS_ALLOW_VERCEL_ORIGINS) {
    try {
      const parsed = new URL(origin);
      return parsed.hostname.toLowerCase().endsWith('.vercel.app');
    } catch {
      return false;
    }
  }

  if (!env.isProduction) {
    try {
      const parsed = new URL(origin);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }

  return false;
}

/** Echoes the browser's requested headers the way ASP.NET does: trimmed, comma-joined, no spaces. */
function echoRequestedHeaders(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
    .join(',');
}

export function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin === undefined) {
    // No Origin header — not a browser request; CORS headers would be noise.
    next();
    return;
  }

  const isPreflight =
    req.method === 'OPTIONS' &&
    (req.headers['access-control-request-method'] !== undefined ||
      req.headers['access-control-request-headers'] !== undefined);

  if (isPreflight) {
    if (!originAllowed(origin)) {
      // Same answer shape as ASP.NET: 204 with nothing on it — the browser
      // itself refuses to send the real request.
      res.status(204).end();
      return;
    }

    const headers = echoRequestedHeaders(req.headers['access-control-request-headers'] as string | undefined);
    res
      .status(204)
      .set('access-control-allow-origin', origin)
      .set('access-control-allow-methods', ALLOWED_METHODS);
    if (headers !== undefined) {
      res.set('access-control-allow-headers', headers);
    }
    appendVary(res, 'Origin');
    res.end();
    return;
  }

  if (originAllowed(origin)) {
    res.set('access-control-allow-origin', origin);
    // "Vary: Origin" is appended at header-FLUSH time, not here: compression
    // (earlier in the pipeline) registered its on-headers listener first and
    // appends "Accept-Encoding" when it compresses, so the listener order
    // reproduces the captured value "Accept-Encoding, Origin". A synchronous
    // append here would invert it — and preflight responses, which end before
    // any listener fires, keep their bare "Origin".
    onHeaders(res, () => {
      appendVary(res, 'Origin');
    });
  }
  next();
}

/**
 * Appends to the Vary header instead of clobbering it: response compression
 * (running earlier) has already marked responses with "Accept-Encoding", and
 * ASP.NET's middleware stack produces "Accept-Encoding, Origin" in that order.
 */
function appendVary(res: Response, value: string): void {
  const existing = res.getHeader('vary');
  if (existing === undefined) {
    res.setHeader('vary', value);
    return;
  }
  const current = Array.isArray(existing) ? existing.join(', ') : String(existing);
  const parts = current.split(',').map((part) => part.trim());
  if (!parts.includes(value)) {
    res.setHeader('vary', `${current}, ${value}`);
  }
}
