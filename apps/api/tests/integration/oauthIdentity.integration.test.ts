import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db.js';
import { externalLogin, AuthSignal } from '../../src/services/authService.js';

const userIds: string[] = [];
const providerSubjects: string[] = [];

afterEach(async () => {
  if (providerSubjects.length > 0) {
    await db.oAuthIdentity.deleteMany({ where: { providerSubject: { in: [...providerSubjects] } } });
    providerSubjects.length = 0;
  }
  if (userIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: [...userIds] } } });
    userIds.length = 0;
  }
});

describe('OAuth provider identity PostgreSQL integration', () => {
  it('links a verified Google subject once and subsequently authenticates by subject', async () => {
    const email = `oauth-${randomUUID()}@example.test`;
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash: 'test-only-hash',
        roles: [],
        createdAt: new Date(),
        updatedAt: null,
      },
    });
    userIds.push(user.id);
    const subject = `google-${randomUUID()}`;
    providerSubjects.push(subject);

    const first = await externalLogin('google', subject, email, true, 'Google Profile', null);
    expect(first.user.id).toBe(user.id);

    const second = await externalLogin('google', subject, null, false, 'Updated Provider Name', null);
    expect(second.user.id).toBe(user.id);

    const binding = await db.oAuthIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'google', providerSubject: subject } },
    });
    expect(binding?.userId).toBe(user.id);
    expect(binding?.emailVerified).toBe(true);
  });

  it('does not create or link a Facebook account from an unverified email', async () => {
    const email = `facebook-${randomUUID()}@example.test`;
    const subject = `facebook-${randomUUID()}`;
    providerSubjects.push(subject);

    await expect(externalLogin('facebook', subject, email, false, 'Facebook User', null))
      .rejects.toBeInstanceOf(AuthSignal);

    expect(await db.user.findUnique({ where: { email } })).toBeNull();
    expect(await db.oAuthIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'facebook', providerSubject: subject } },
    })).toBeNull();
  });

  it('enforces provider-subject uniqueness at the database boundary', async () => {
    const email = `unique-${randomUUID()}@example.test`;
    const subject = `google-${randomUUID()}`;
    providerSubjects.push(subject);

    const first = await externalLogin('google', subject, email, true, null, null);
    userIds.push(String(first.user.id));
    const secondEmail = `second-${randomUUID()}@example.test`;
    await expect(externalLogin('google', subject, secondEmail, true, null, null))
      .resolves.toMatchObject({ user: { id: first.user.id } });
    expect(await db.user.findUnique({ where: { email: secondEmail } })).toBeNull();
  });
});
