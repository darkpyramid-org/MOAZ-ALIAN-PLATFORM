import { Router, type Request, type Response } from 'express';

/**
 * GET /health — the port of MapHealthChecks. Anonymous on purpose: it reports
 * only "Healthy", never schema, counts, or connection details, so a probe can
 * run anywhere (container liveness, uptime checks) without leaking state.
 *
 * The content type is "text/plain" WITHOUT a charset — HealthCheckMiddleware's
 * exact wire form; every other text surface on this API carries a charset, so
 * the header is set explicitly rather than left to Express's default
 * ("text/plain; charset=utf-8").
 */
const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).set('content-type', 'text/plain').send('Healthy');
});

export const healthRoutes = router;
