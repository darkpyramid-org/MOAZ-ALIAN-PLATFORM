import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { fixedTimeEquals, hmacSha256Base64 } from '../lib/password.js';

export type OAuthProviderName = 'google' | 'facebook';

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_TTL_SECONDS = STATE_TTL_MS / 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cookieName(provider: OAuthProviderName, nonce: string): string {
  return `oauth_${provider}_${nonce}`;
}

function cookiePath(provider: OAuthProviderName): string {
  return `/api/auth/oauth/${provider}/callback`;
}

function serializeCookie(name: string, value: string, provider: OAuthProviderName, clear = false): string {
  const parts = [
    `${name}=${clear ? '' : encodeURIComponent(value)}`,
    `Path=${cookiePath(provider)}`,
    'HttpOnly',
    'SameSite=Lax',
    clear ? 'Max-Age=0' : `Max-Age=${STATE_TTL_SECONDS}`,
  ];
  if (env.isProduction) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    const raw = item.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

interface ParsedState {
  timestamp: number;
  nonce: string;
}

function parseAndVerifyState(state: string): ParsedState | null {
  try {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(state)) return null;
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== state) return null;

    const parts = decoded.split('.');
    if (parts.length !== 3) return null;

    const timestampText = parts[0] ?? '';
    const nonce = parts[1] ?? '';
    const signature = parts[2] ?? '';
    if (!/^[0-9]{10}$/.test(timestampText) || !/^[A-Za-z0-9_-]{22}$/.test(nonce)) return null;
    if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) return null;

    const timestamp = Number(timestampText);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(timestamp) || timestamp > now || now - timestamp > STATE_TTL_SECONDS) return null;

    const payload = `${timestampText}.${nonce}`;
    const expected = hmacSha256Base64(payload, env.AUTH_JWT_SECRET);
    if (!fixedTimeEquals(expected, signature)) return null;

    return { timestamp, nonce };
  } catch {
    return null;
  }
}

/**
 * Creates a signed OAuth state and a separate browser-only correlation secret.
 * The database stores hashes only, so a database read does not disclose either
 * raw value. The per-attempt cookie name permits concurrent OAuth attempts.
 */
export function getOAuthStateNonce(state: string): string | null {
  return parseAndVerifyState(state)?.nonce ?? null;
}

export async function createOAuthState(
  provider: OAuthProviderName,
  _req: Request,
  res: Response,
): Promise<string> {
  const now = new Date();
  const nonce = randomBytes(16).toString('base64url');
  const browserBinding = randomBytes(32).toString('base64url');
  const timestamp = Math.floor(now.getTime() / 1000).toString(10);
  const payload = `${timestamp}.${nonce}`;
  const signature = hmacSha256Base64(payload, env.AUTH_JWT_SECRET);
  const state = Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');

  // Opportunistic bounded cleanup: expired attempts cannot be consumed.
  await db.oAuthState.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.oAuthState.create({
    data: {
      nonceHash: sha256(nonce),
      browserBindingHash: sha256(browserBinding),
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    },
  });

  res.append('Set-Cookie', serializeCookie(cookieName(provider, nonce), browserBinding, provider));
  return state;
}

/**
 * Atomic PostgreSQL DELETE ... WHERE ... RETURNING count is the single-use
 * gate. Concurrent callbacks race on the same row; exactly one can consume it.
 */
export async function consumeOAuthState(
  provider: OAuthProviderName,
  state: string,
  req: Request,
  res: Response,
): Promise<boolean> {
  const parsed = parseAndVerifyState(state);
  if (parsed === null) return false;

  const name = cookieName(provider, parsed.nonce);
  const browserBinding = readCookie(req, name);
  res.append('Set-Cookie', serializeCookie(name, '', provider, true));
  if (browserBinding === null || !/^[A-Za-z0-9_-]{43}$/.test(browserBinding)) return false;

  const now = new Date();
  const consumed = await db.oAuthState.deleteMany({
    where: {
      nonceHash: sha256(parsed.nonce),
      browserBindingHash: sha256(browserBinding),
      expiresAt: { gt: now },
    },
  });
  return consumed.count === 1;
}
