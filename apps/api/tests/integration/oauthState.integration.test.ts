import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db.js';
import { consumeOAuthState, createOAuthState } from '../../src/lib/oauthState.js';

const issuedNonceHashes: string[] = [];

function responseRecorder() {
  const headers: string[] = [];
  return {
    headers,
    response: { append: (_name: string, value: string) => headers.push(value) } as unknown as Response,
  };
}

function requestWithCookie(cookie?: string): Request {
  return { headers: cookie ? { cookie } : {} } as Request;
}

function cookieFrom(headers: string[]): string {
  const header = headers.find((value) => value.startsWith('oauth_'));
  if (!header) throw new Error('OAuth correlation cookie was not set.');
  return header.split(';', 1)[0] ?? '';
}

function nonceHashFrom(state: string): string {
  const decoded = Buffer.from(state, 'base64url').toString('utf8');
  const nonce = decoded.split('.')[1];
  if (!nonce) throw new Error('OAuth state nonce is missing.');
  const hash = createHash('sha256').update(nonce, 'utf8').digest('hex');
  issuedNonceHashes.push(hash);
  return hash;
}

afterEach(async () => {
  if (issuedNonceHashes.length > 0) {
    await db.oAuthState.deleteMany({ where: { nonceHash: { in: [...issuedNonceHashes] } } });
    issuedNonceHashes.length = 0;
  }
});

describe('OAuth state PostgreSQL integration', () => {
  it.each(['google', 'facebook'] as const)('consumes a valid %s state once', async (provider) => {
    const issued = responseRecorder();
    const state = await createOAuthState(provider, {} as Request, issued.response);
    nonceHashFrom(state);

    const callback = responseRecorder();
    const cookie = cookieFrom(issued.headers);
    expect(await consumeOAuthState(provider, state, requestWithCookie(cookie), callback.response)).toBe(true);
    expect(await consumeOAuthState(provider, state, requestWithCookie(cookie), callback.response)).toBe(false);
  });

  it('rejects a different browser but preserves the attempt for the initiating browser', async () => {
    const issued = responseRecorder();
    const state = await createOAuthState('google', {} as Request, issued.response);
    nonceHashFrom(state);

    expect(await consumeOAuthState('google', state, requestWithCookie(), issued.response)).toBe(false);
    expect(await consumeOAuthState('google', state, requestWithCookie(cookieFrom(issued.headers)), issued.response)).toBe(true);
  });

  it('allows only one concurrent callback to consume the same database row', async () => {
    const issued = responseRecorder();
    const state = await createOAuthState('facebook', {} as Request, issued.response);
    nonceHashFrom(state);
    const cookie = cookieFrom(issued.headers);

    const results = await Promise.all([
      consumeOAuthState('facebook', state, requestWithCookie(cookie), responseRecorder().response),
      consumeOAuthState('facebook', state, requestWithCookie(cookie), responseRecorder().response),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('rejects a state whose persisted expiry has elapsed', async () => {
    const issued = responseRecorder();
    const state = await createOAuthState('google', {} as Request, issued.response);
    const nonceHash = nonceHashFrom(state);
    await db.oAuthState.update({
      where: { nonceHash },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await consumeOAuthState('google', state, requestWithCookie(cookieFrom(issued.headers)), issued.response)).toBe(false);
  });
});
