import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { db } from '../../src/lib/db.js';

const mocks = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../src/lib/passwordResetMailer.js', () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

const app = createApp();
const initialPassword = 'Integration-Initial-Password-2026!';
const nextPassword = 'Integration-Updated-Password-2026!';
const emails = [
  'recovery-owner-' + randomUUID() + '@example.test',
  'recovery-failure-' + randomUUID() + '@example.test',
];

async function register(email: string): Promise<void> {
  await request(app)
    .post('/api/auth/register')
    .send({ email, password: initialPassword })
    .expect(200);
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL integration: password recovery', () => {
  beforeEach(() => {
    mocks.sendPasswordResetEmail.mockReset();
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } });
  });

  it('sends a digest-backed one-time token and keeps registered/unknown responses identical', async () => {
    await register(emails[0]!);

    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: emails[0] })
      .expect(200);
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown-' + randomUUID() + '@example.test' })
      .expect(200);

    expect(known.body).toEqual(unknown.body);
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const [sentEmail, rawToken] = mocks.sendPasswordResetEmail.mock.calls[0] as [string, string];
    expect(sentEmail).toBe(emails[0]);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = await db.user.findUnique({ where: { email: emails[0] } });
    expect(stored?.passwordResetToken).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(stored?.passwordResetToken).not.toBe(rawToken);
    expect(stored?.passwordResetExpiresAt?.getTime()).toBeGreaterThan(Date.now());

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: nextPassword })
      .expect(204);

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'Replay-Password-2026!' })
      .expect(400);

    await request(app)
      .post('/api/auth/login')
      .send({ email: emails[0], password: initialPassword })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: emails[0], password: nextPassword })
      .expect(200);

    const consumed = await db.user.findUnique({ where: { email: emails[0] } });
    expect(consumed?.passwordResetToken).toBeNull();
    expect(consumed?.passwordResetExpiresAt).toBeNull();
  });

  it('rejects an expired token and clears tokens when email delivery fails', async () => {
    await register(emails[1]!);
    const expiredToken = 'expired-token-' + randomUUID();
    const expiredDigest = createHash('sha256').update(expiredToken).digest('hex');
    await db.user.update({
      where: { email: emails[1] },
      data: {
        passwordResetToken: expiredDigest,
        passwordResetExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: expiredToken, newPassword: nextPassword })
      .expect(400);

    mocks.sendPasswordResetEmail.mockRejectedValueOnce(new Error('provider unavailable'));
    const failedDelivery = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: emails[1] })
      .expect(200);
    expect(failedDelivery.body.message).toBeDefined();

    const afterFailure = await db.user.findUnique({ where: { email: emails[1] } });
    expect(afterFailure?.passwordResetToken).toBeNull();
    expect(afterFailure?.passwordResetExpiresAt).toBeNull();
  });
});
