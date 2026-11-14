import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { sendJson, sendRedirect } from '../lib/http.js';

/**
 * GET / — the port of the two mutually exclusive MapGet("/") registrations in
 * Program.cs: with the docs surface on, navigating to root lands in Swagger
 * UI (302 with an empty body — Results.Redirect writes no content); with it
 * off, root IS the API's front door and answers a small status document so a
 * bare hostname in production tells the caller it reached the right service.
 *
 * The switch is evaluated per request against the same env the docs module
 * mounts on, keeping the two modules consistent under one configuration.
 */
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  if (env.docsEnabled) {
    sendRedirect(res, '/swagger');
    return;
  }
  // Results.Ok's anonymous object: key order is part of the contract.
  sendJson(res, 200, {
    status: 'online',
    service: 'MOAZ ALIAN API',
    health: '/health',
  });
});

export const rootRoutes = router;
