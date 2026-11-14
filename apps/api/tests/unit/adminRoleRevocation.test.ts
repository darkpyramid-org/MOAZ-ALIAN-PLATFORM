import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));

import { adminRoutes } from '../../src/modules/admin.js';

const userId = '11111111-1111-4111-8111-111111111111';
const existingUser = {
  id: userId,
  email: 'editor@example.test',
  roles: ['admin', 'editor'],
  createdAt: new Date(),
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.auth = {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'admin@example.test',
      roles: ['admin'],
      isAdmin: true,
      canEditContent: true,
    };
    next();
  });
  instance.use(adminRoutes);
  return instance;
}

describe('admin role changes revoke user sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(existingUser);
    mocks.update.mockImplementation(async ({ data }: { data: { roles: string[] } }) => ({
      ...existingUser,
      ...data,
    }));
  });

  it('increments tokenVersion when a privileged role is removed', async () => {
    await request(app())
      .post(`/api/users/${userId}/roles`)
      .send({ role: 'admin', has: true })
      .expect(200);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({
        roles: ['editor'],
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('does not revoke sessions when the requested role state is already satisfied', async () => {
    await request(app())
      .post(`/api/users/${userId}/roles`)
      .send({ role: 'admin', has: false })
      .expect(200);

    const updateArg = mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updateArg.data.roles).toEqual(['admin', 'editor']);
    expect(updateArg.data.tokenVersion).toBeUndefined();
  });
});
