import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: { user: { findUnique: mocks.findUnique } },
}));

vi.mock('../../src/lib/password.js', () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: vi.fn(),
  DUMMY_PASSWORD_HASH: 'fixed-dummy-hash',
  VerificationResult: { Failed: 0, Success: 1, SuccessRehashNeeded: 2 },
  isPasswordWithinLimit: (value: string) => Buffer.byteLength(value, 'utf8') <= 1024,
  MAX_PASSWORD_BYTES: 1024,
}));

import { AuthSignal, login } from '../../src/services/authService.js';

describe('login account-enumeration timing work', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(0);
  });

  it('performs password verification against the dummy hash for an unknown email', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(login('missing@example.test', 'wrong-password')).rejects.toMatchObject({
      kind: 'unauthorized',
      message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith('fixed-dummy-hash', 'wrong-password');
  });

  it('performs the same verification operation for a known email with a wrong password', async () => {
    mocks.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'known@example.test',
      passwordHash: 'stored-v3-hash',
      roles: ['editor'],
      displayName: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: null,
      tokenVersion: 0,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
    await expect(login('known@example.test', 'wrong-password')).rejects.toBeInstanceOf(AuthSignal);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('stored-v3-hash', 'wrong-password');
  });
});
