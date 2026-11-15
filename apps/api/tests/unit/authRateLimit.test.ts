import express from 'express';
import request from 'supertest';
import { describe, it } from 'vitest';
import { authRateLimit } from '../../src/middleware/authRateLimit.js';
import { collectRawBody } from '../../src/middleware/body.js';

describe('credential endpoint rate limits', () => {
  it('limits repeated requests for one normalized account and direct client IP', async () => {
    const app = express();
    app.use(collectRawBody);
    app.post('/auth', authRateLimit, (_req, res) => res.status(200).json({ ok: true }));

    const email = 'rate-limit-' + crypto.randomUUID() + '@example.test';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/auth').send({ email }).expect(200);
    }
    await request(app).post('/auth').send({ email: email.toUpperCase() }).expect(429);
  });
});
