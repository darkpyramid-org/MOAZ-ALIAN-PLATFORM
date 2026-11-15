import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DUMMY_PASSWORD_HASH,
  MAX_PASSWORD_BYTES,
  VerificationResult,
  hashPassword,
  isPasswordWithinLimit,
  verifyPassword,
} from '../../src/lib/password.js';

describe('ASP.NET Identity password hashing', () => {
  it('creates and verifies an asynchronous V3 hash', async () => {
    const encoded = await hashPassword('correct horse battery staple');
    expect(Buffer.from(encoded, 'base64')[0]).toBe(0x01);
    await expect(verifyPassword(encoded, 'correct horse battery staple')).resolves.toBe(VerificationResult.Success);
    await expect(verifyPassword(encoded, 'incorrect password')).resolves.toBe(VerificationResult.Failed);
  });

  it('continues to verify legacy V2 hashes and marks them for rehash', async () => {
    const salt = randomBytes(16);
    const subkey = pbkdf2Sync('legacy-password', salt, 1_000, 32, 'sha1');
    const encoded = Buffer.concat([Buffer.from([0x00]), salt, subkey]).toString('base64');
    await expect(verifyPassword(encoded, 'legacy-password')).resolves.toBe(VerificationResult.SuccessRehashNeeded);
  });

  it('uses a valid fixed dummy hash for unknown-account login work', async () => {
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, 'arbitrary-password')).resolves.toBe(VerificationResult.Failed);
  });

  it('bounds passwords by UTF-8 byte length', async () => {
    expect(isPasswordWithinLimit('a'.repeat(MAX_PASSWORD_BYTES))).toBe(true);
    expect(isPasswordWithinLimit('a'.repeat(MAX_PASSWORD_BYTES + 1))).toBe(false);
    await expect(hashPassword('a'.repeat(MAX_PASSWORD_BYTES + 1))).rejects.toThrow(RangeError);
  });

  it('keeps the event loop responsive while derivations run concurrently', async () => {
    let eventLoopContinued = false;
    const derivations = Array.from({ length: 4 }, (_, index) => hashPassword('concurrent-password-' + index));
    await new Promise<void>((resolve) => setImmediate(() => {
      eventLoopContinued = true;
      resolve();
    }));
    expect(eventLoopContinued).toBe(true);
    await Promise.all(derivations);
  });
});
