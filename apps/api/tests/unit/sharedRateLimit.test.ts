import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedFetch = vi.fn();

describe('shared Upstash fixed-window counter', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only-token';
    vi.stubGlobal('fetch', mockedFetch);
    mockedFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('uses one atomic EVAL command and the same opaque partition key across instances', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: [7, 54_000] }),
    });
    const { incrementSharedRateLimit } = await import('../../src/middleware/rateLimit.js');

    const first = await incrementSharedRateLimit('global', 'ip:203.0.113.10');
    const second = await incrementSharedRateLimit('global', 'ip:203.0.113.10');

    expect(first).toBe(7);
    expect(second).toBe(7);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    const calls = mockedFetch.mock.calls as unknown as [string, RequestInit][];
    const firstCommand = JSON.parse(String(calls[0]?.[1]?.body)) as string[];
    const secondCommand = JSON.parse(String(calls[1]?.[1]?.body)) as string[];
    expect(firstCommand[0]).toBe('EVAL');
    expect(firstCommand[1]).toContain('INCR');
    expect(firstCommand[1]).toContain('PEXPIRE');
    expect(firstCommand[2]).toBe('1');
    expect(firstCommand[3]).toBe(secondCommand[3]);
    expect(firstCommand[3]).not.toContain('203.0.113.10');
    expect(firstCommand[4]).toBe('60000');
  });

  it('fails explicitly when the shared store rejects the command', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 503 });
    const { incrementSharedRateLimit } = await import('../../src/middleware/rateLimit.js');
    await expect(incrementSharedRateLimit('editorial', 'user:123')).rejects.toThrow('HTTP 503');
  });

  it.each([null, 0, -1, 1.5, '', true])(
    'rejects invalid Redis counter values (%s)',
    async (value) => {
      mockedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ result: [value, 54_000] }),
      });
      const { incrementSharedRateLimit } = await import('../../src/middleware/rateLimit.js');
      await expect(incrementSharedRateLimit('global', 'user:123')).rejects.toThrow('invalid counter response');
    },
  );

  it('rejects a non-array Redis result', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'not-a-counter' }),
    });
    const { incrementSharedRateLimit } = await import('../../src/middleware/rateLimit.js');
    await expect(incrementSharedRateLimit('global', 'user:123')).rejects.toThrow('invalid counter response');
  });
});
