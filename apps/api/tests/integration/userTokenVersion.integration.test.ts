import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/db.js';
import { issueToken, verifyToken } from '../../src/lib/jwt.js';

const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    createdUserIds.length = 0;
  }
});

describe('user token version PostgreSQL migration', () => {
  it('defaults existing/new users to version zero and increments atomically', async () => {
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        email: `token-version-${randomUUID()}@example.test`,
        passwordHash: 'integration-test-hash',
        roles: ['editor'],
        createdAt: new Date(),
        updatedAt: null,
      },
    });
    createdUserIds.push(user.id);

    expect(user.tokenVersion).toBe(0);
    const token = issueToken(user);
    expect(verifyToken(token)?.ver).toBe(0);

    const updated = await db.user.update({
      where: { id: user.id },
      data: { roles: [], tokenVersion: { increment: 1 } },
    });
    expect(updated.tokenVersion).toBe(1);
    expect(verifyToken(token)?.ver).toBe(0);
  });
});
