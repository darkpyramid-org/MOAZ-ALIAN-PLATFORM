import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  hashPassword: vi.fn(() => 'new-password-hash'),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock('../../src/lib/passwordResetMailer.js', () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));
vi.mock('../../src/lib/password.js', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
  VerificationResult: { Failed: 0, Success: 1, SuccessRehashNeeded: 2 },
}));

import { AuthSignal, forgotPassword, resetPassword } from '../../src/services/authService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'person@example.test' };

describe('password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(user);
    mocks.update.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue({ ...user, passwordResetExpiresAt: new Date(Date.now() + 60_000) });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('does not send email or write a token for an unknown account', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(forgotPassword('missing@example.test')).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores only a SHA-256 digest and sends the raw token out of band', async () => {
    await forgotPassword(' PERSON@example.test ');
    const stored = mocks.update.mock.calls[0]?.[0]?.data?.passwordResetToken as string;
    const [email, rawToken] = mocks.sendPasswordResetEmail.mock.calls[0] as [string, string];
    expect(email).toBe('person@example.test');
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(stored).not.toBe(rawToken);
    expect(mocks.update.mock.calls[0]?.[0]?.data?.passwordResetExpiresAt).toBeInstanceOf(Date);
  });

  it('clears the pending token when the mail provider fails without exposing delivery state', async () => {
    mocks.sendPasswordResetEmail.mockRejectedValue(new Error('provider unavailable'));
    await expect(forgotPassword('person@example.test')).resolves.toBeUndefined();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: user.id, passwordResetToken: expect.any(String) }),
      data: expect.objectContaining({ passwordResetToken: null, passwordResetExpiresAt: null }),
    }));
  });

  it('atomically consumes a valid token once', async () => {
    await resetPassword('raw-reset-token', 'new-password-123');
    const digest = createHash('sha256').update('raw-reset-token').digest('hex');
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { passwordResetToken: digest, passwordResetExpiresAt: { gt: expect.any(Date) } },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: user.id, passwordResetToken: digest }),
      data: expect.objectContaining({
        passwordHash: 'new-password-hash',
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      }),
    }));
  });

  it('rejects a replay when another request already consumed the token', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(resetPassword('replayed-token', 'new-password-123')).rejects.toBeInstanceOf(AuthSignal);
  });

  it('allows only one winner when two reset requests race', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const outcomes = await Promise.allSettled([
      resetPassword('same-token', 'new-password-123'),
      resetPassword('same-token', 'new-password-456'),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects an expired or unknown token', async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(resetPassword('expired-token', 'new-password-123')).rejects.toBeInstanceOf(AuthSignal);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
