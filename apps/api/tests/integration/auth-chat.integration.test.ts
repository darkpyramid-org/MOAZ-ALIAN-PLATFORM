import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { db } from '../../src/lib/db.js';

const app = createApp();
const password = 'Integration-Test-Password-2026!';
const testEmails = [
  `integration-owner-${randomUUID()}@example.test`,
  `integration-other-${randomUUID()}@example.test`,
];

interface RegisteredUser {
  email: string;
  token: string;
}

async function registerUser(email: string): Promise<RegisteredUser> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email, password })
    .expect(200);

  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user.email).toBe(email);

  return { email, token: response.body.token as string };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL integration: auth and chat ownership', () => {
  let owner: RegisteredUser;
  let other: RegisteredUser;

  beforeAll(async () => {
    owner = await registerUser(testEmails[0]!);
    other = await registerUser(testEmails[1]!);
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: testEmails } } });
  });

  it('registers, authenticates, rejects duplicate accounts, and returns the persisted identity', async () => {
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ email: owner.email, password })
      .expect(409);

    expect(duplicate.body).toBeDefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: owner.email.toUpperCase(), password })
      .expect(200);

    expect(login.body.token).toEqual(expect.any(String));

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token as string}`)
      .expect(200);

    expect(me.body.email).toBe(owner.email);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid credentials without disclosing whether the account exists', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: owner.email, password: 'Wrong-Password-2026!' });

    const unknownAccount = await request(app)
      .post('/api/auth/login')
      .send({ email: `missing-${randomUUID()}@example.test`, password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(wrongPassword.body.detail).toBe(unknownAccount.body.detail);
  });

  it('isolates chat thread listing and message operations by authenticated owner', async () => {
    const created = await request(app)
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Owner-only integration thread' })
      .expect(200);

    const threadId = created.body.id as string;
    expect(threadId).toEqual(expect.any(String));

    const ownerThreads = await request(app)
      .get('/api/chat/threads')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(ownerThreads.body.some((thread: { id: string }) => thread.id === threadId)).toBe(true);

    const otherThreads = await request(app)
      .get('/api/chat/threads')
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);

    expect(otherThreads.body.some((thread: { id: string }) => thread.id === threadId)).toBe(false);

    await request(app)
      .get(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);

    await request(app)
      .post(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ role: 'user', content: 'unauthorized write' })
      .expect(404);

    await request(app)
      .delete(`/api/chat/threads/${threadId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);

    await request(app)
      .post(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'user', content: 'owner message' })
      .expect(200);

    const ownerMessages = await request(app)
      .get(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(ownerMessages.body).toHaveLength(1);
    expect(ownerMessages.body[0].content).toBe('owner message');
  });
});
