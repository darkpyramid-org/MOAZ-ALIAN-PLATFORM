import express from 'express';
import compression from 'compression';
import { trace } from './middleware/trace.js';
import { cors } from './middleware/cors.js';
import { authenticate } from './middleware/auth.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { collectRawBody } from './middleware/body.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sendStatusPage, traceOf } from './lib/http.js';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth.js';
import { adminRoutes } from './modules/admin.js';
import { oauthRoutes } from './modules/oauth.js';
import { contentRoutes } from './modules/content.js';
import { categoryRoutes } from './modules/categories.js';
import { chatRoutes } from './modules/chat.js';
import { docsRoutes } from './modules/docs.js';
import { healthRoutes } from './modules/health.js';
import { rootRoutes } from './modules/root.js';

/**
 * The application pipeline — a direct transcription of Program.cs's
 * `app.Use…` sequence. The order is observable wire behaviour, not style:
 *
 *   trace            → every error-shaped body embeds a Kestrel-shaped id
 *   compression      → "Vary: Accept-Encoding" + gzip, .NET's threshold 0
 *                      (it registers its header listener FIRST, which is what
 *                      puts "Accept-Encoding" before CORS's "Origin")
 *   cors             → preflight short-circuit + allowed-origin headers
 *   authenticate     → parse the bearer token for EVERY request (UseAuthentication
 *                      runs globally; only the gates consult the result)
 *   globalRateLimit  → the 300/min budget, partitioned user-or-IP
 *   collectRawBody   → buffer bodies once; the binders own the parsing
 *   routes           → registration order mirrors Map…Endpoints in Program.cs
 *                      (auth, admin, oauth, content, categories), then the
 *                      additive chat surface, then docs/health/root
 *   404 fallback     → StatusCodePages' JSON body for unmounted paths
 *   errorHandler     → GlobalExceptionHandler's problem-details, outermost
 */
export function createApp(): express.Express {
  const app = express();

  // Two Express defaults .NET never emitted: the framework banner and a
  // conditional-request ETag (compression makes the ETag useless anyway — the
  // gzipped bytes differ from the response it would validate).
  app.disable('x-powered-by');
  app.set('etag', false);
  // Honor forwarded client IPs only from explicitly trusted ingress peers.
  app.set('trust proxy', env.trustedProxyCidrs);

  app.use(trace);
  app.use(
    // .NET's ResponseCompression ran with EnableForHttps=false and the default
    // MIME list; threshold 0 reproduces its "compress every compressible
    // response" behaviour the goldens recorded.
    compression({ threshold: 0 }),
  );
  app.use(cors);
  app.use(authenticate);
  app.use(globalRateLimit);
  app.use(collectRawBody);

  app.use(authRoutes);
  app.use(adminRoutes);
  app.use(oauthRoutes);
  app.use(contentRoutes);
  app.use(categoryRoutes);
  // Additive (migration decision D3): no .NET counterpart; mounted last so a
  // future /api/chat path can never shadow a ported route.
  app.use(chatRoutes);

  if (env.docsEnabled) {
    app.use(docsRoutes);
  }

  app.use(healthRoutes);
  app.use(rootRoutes);

  // Unmounted path → bare 404, rendered by the status-page pass (the same
  // body a completely unknown path gets — a route-constraint miss included).
  app.use((_req, res, _next) => {
    sendStatusPage(res, 404, traceOf(_req));
  });

  app.use(errorHandler);

  return app;
}
