import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const stateStore = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: { oAuthState: stateStore },
}));

import { consumeOAuthState, createOAuthState } from '../../src/lib/oauthState.js';

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

function nonceFrom(state: string): string {
  const decoded = Buffer.from(state, 'base64url').toString('utf8');
  return decoded.split('.')[1] ?? '';
}

describe('browser-bound OAuth state', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    stateStore.deleteMany.mockResolvedValue({ count: 0 });
    stateStore.create.mockResolvedValue({});
  });

  afterEach(() => vi.useRealTimers());

  it.each(['google', 'facebook'] as const)('creates and consumes a one-time %s state', async (provider) => {
    const { headers, response } = responseRecorder();
    const state = await createOAuthState(provider, {} as Request, response);
    const cookie = cookieFrom(headers);

    expect(headers[0]).toContain('HttpOnly');
    expect(headers[0]).toContain('SameSite=Lax');
    expect(headers[0]).toContain(`Path=/api/auth/oauth/${provider}/callback`);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(stateStore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nonceHash: expect.any(String),
        browserBindingHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });

    stateStore.deleteMany.mockResolvedValueOnce({ count: 1 });
    const callback = responseRecorder();
    expect(await consumeOAuthState(provider, state, requestWithCookie(cookie), callback.response)).toBe(true);
    expect(callback.headers[0]).toContain('Max-Age=0');
    expect(stateStore.deleteMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        nonceHash: expect.any(String),
        browserBindingHash: expect.any(String),
        expiresAt: { gt: expect.any(Date) },
      }),
    });
  });

  it('rejects a callback from a different browser session', async () => {
    const { response } = responseRecorder();
    const state = await createOAuthState('google', {} as Request, response);

    expect(await consumeOAuthState('google', state, requestWithCookie(), response)).toBe(false);
    // Only the creation-time expired-row cleanup may run.
    expect(stateStore.deleteMany).toHaveBeenCalledTimes(1);
    expect(nonceFrom(state)).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('rejects a modified signature without touching the state store', async () => {
    const { headers, response } = responseRecorder();
    const state = await createOAuthState('google', {} as Request, response);
    const tampered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`;

    stateStore.deleteMany.mockClear();
    expect(await consumeOAuthState('google', tampered, requestWithCookie(cookieFrom(headers)), response)).toBe(false);
    expect(stateStore.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects expired state before attempting consumption', async () => {
    const { headers, response } = responseRecorder();
    const state = await createOAuthState('facebook', {} as Request, response);
    const cookie = cookieFrom(headers);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    stateStore.deleteMany.mockClear();

    expect(await consumeOAuthState('facebook', state, requestWithCookie(cookie), response)).toBe(false);
    expect(stateStore.deleteMany).not.toHaveBeenCalled();
  });

  it('allows exactly one winner when callbacks race', async () => {
    const { headers, response } = responseRecorder();
    const state = await createOAuthState('google', {} as Request, response);
    const cookie = cookieFrom(headers);
    let consumed = false;
    stateStore.deleteMany.mockImplementation(async () => {
      if (consumed) return { count: 0 };
      consumed = true;
      return { count: 1 };
    });

    const results = await Promise.all([
      consumeOAuthState('google', state, requestWithCookie(cookie), response),
      consumeOAuthState('google', state, requestWithCookie(cookie), response),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
