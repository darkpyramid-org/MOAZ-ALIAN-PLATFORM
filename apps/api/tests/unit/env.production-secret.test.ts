import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadEnvironment() {
  vi.resetModules();
  const { loadEnv } = await import('../../src/config/env.js');
  return loadEnv();
}

describe('production JWT secret validation', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_STORE = 'upstash';
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-upstash-token';
    delete process.env.AUTH_JWT_SECRET;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it('fails when AUTH_JWT_SECRET is missing in production', async () => {
    await expect(loadEnvironment()).rejects.toThrow(
      'AUTH_JWT_SECRET must be explicitly configured in production',
    );
  });

  it('rejects the built-in development fallback in production', async () => {
    process.env.AUTH_JWT_SECRET =
      'fallback-secret-minimum-32-characters-for-preview-development';

    await expect(loadEnvironment()).rejects.toThrow(
      'AUTH_JWT_SECRET is weak or uses a development placeholder',
    );
  });

  it('rejects low-diversity secrets even when they are long enough', async () => {
    process.env.AUTH_JWT_SECRET = 'a'.repeat(64);

    await expect(loadEnvironment()).rejects.toThrow(
      'AUTH_JWT_SECRET is weak or uses a development placeholder',
    );
  });

  it('accepts an explicitly configured strong production secret', async () => {
    process.env.AUTH_JWT_SECRET =
      'A1!bC2@dE3#fG4$hI5%jK6^lM7&mN8*oP9(';

    const env = await loadEnvironment();

    expect(env.isProduction).toBe(true);
    expect(env.AUTH_JWT_SECRET).toBe(process.env.AUTH_JWT_SECRET);
  });
});
