import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { clientIp } from '../../src/middleware/rateLimit.js';

function ipApp(trustedProxies: string[]) {
  const app = express();
  app.set('trust proxy', trustedProxies);
  app.get('/ip', (req, res) => res.json({ ip: clientIp(req) }));
  return app;
}

describe('clientIp — trusted proxy boundary', () => {
  it('ignores a spoofed X-Forwarded-For header from an untrusted peer', async () => {
    const response = await request(ipApp(['10.0.0.0/8']))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.77')
      .expect(200);

    expect(response.body.ip).toBe('127.0.0.1');
  });

  it('uses X-Forwarded-For when the immediate peer is explicitly trusted', async () => {
    const response = await request(ipApp(['loopback']))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.77')
      .expect(200);

    expect(response.body.ip).toBe('203.0.113.77');
  });

  it('walks a multi-hop chain and stops at the first untrusted address', async () => {
    const response = await request(ipApp(['loopback', '10.0.0.0/8']))
      .get('/ip')
      .set('X-Forwarded-For', '198.51.100.25, 10.1.2.3')
      .expect(200);

    expect(response.body.ip).toBe('198.51.100.25');
  });

  it('falls back to the socket peer when a trusted proxy sends malformed metadata', async () => {
    const response = await request(ipApp(['loopback']))
      .get('/ip')
      .set('X-Forwarded-For', 'not-an-ip, also-not-an-ip')
      .expect(200);

    expect(response.body.ip).toBe('127.0.0.1');
  });

  it('normalizes IPv4-mapped IPv6 and accepts native IPv6 addresses', () => {
    const mapped = {
      ip: '::ffff:192.0.2.44',
      socket: { remoteAddress: '::1' },
    } as unknown as Request;
    const ipv6 = {
      ip: '2001:db8::42',
      socket: { remoteAddress: '::1' },
    } as unknown as Request;

    expect(clientIp(mapped)).toBe('192.0.2.44');
    expect(clientIp(ipv6)).toBe('2001:db8::42');
  });

  it('uses the socket peer when no forwarded address is available', () => {
    const req = {
      ip: '::ffff:192.0.2.8',
      socket: { remoteAddress: '::ffff:192.0.2.8' },
      headers: {},
    } as unknown as Request;

    expect(clientIp(req)).toBe('192.0.2.8');
  });
});
