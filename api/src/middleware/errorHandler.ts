import type { NextFunction, Request, Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import { UnsupportedMediaTypeFailure } from './body.js';
import { sendStatusPage, traceOf } from '../lib/http.js';
import { sysJson } from '../lib/netjson.js';
import { logger } from '../lib/logger.js';

/**
 * The single place where domain/vocabulary failures become HTTP — a port of
 * WebApi's GlobalExceptionHandler with its exact wire format:
 *
 *   - content-type "application/problem+json";
 *   - type links https://httpstatuses.com/{status} (the handler's own constant,
 *     NOT the RFC 9110 links Results.Problem uses — two different shapes live
 *     side by side on this API);
 *   - NO traceId extension (the handler never sees HttpContext.TraceIdentifier);
 *   - instance = the raw request path;
 *   - the ASCII-safe serialiser: non-ASCII escapes as \uXXXX and ' < > & +
 *     escape, so the JSON is embeddable in any transport (see lib/netjson).
 *
 * .NET reached this handler through a wrapped BadHttpRequestException for
 * binding failures; here BindFailure takes the same default branch so a
 * malformed body produces the identical generic 500 problem.
 */

const PROBLEM_CT = 'application/problem+json';

const STATUS_LINKS: Record<number, string> = {
  400: 'https://httpstatuses.com/400',
  403: 'https://httpstatuses.com/403',
  404: 'https://httpstatuses.com/404',
  409: 'https://httpstatuses.com/409',
  422: 'https://httpstatuses.com/422',
  500: 'https://httpstatuses.com/500',
};

interface ProblemBody {
  [key: string]: unknown;
}

function writeProblem(res: Response, status: number, body: ProblemBody): void {
  res.status(status).set('content-type', PROBLEM_CT).send(sysJson(body));
}

/** Request.Path as the handler saw it: percent-decoded, no query string. */
function instanceOf(req: Request): string {
  const raw = req.originalUrl.split('?')[0] ?? '';
  try {
    return decodeURIComponent(raw);
  } catch {
    // Malformed escapes survive decoding as raw text in .NET too.
    return raw;
  }
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Headers already written (mid-stream failure): the connection must die
  // rather than emit a second status line — same rule the .NET handler obeys.
  if (res.headersSent) {
    res.destroy();
    return;
  }

  const instance = instanceOf(req);

  if (error instanceof UnsupportedMediaTypeFailure) {
    // 415 with an EMPTY body: the .NET binder wrote only the status code and
    // UseStatusCodePages supplied the JSON status page on the way out.
    sendStatusPage(res, 415, traceOf(req));
    return;
  }

  if (error instanceof ValidationError) {
    logger.debug('Validation failed: %s', Object.keys(error.errors).join(', '));
    const body: ProblemBody = {
      type: STATUS_LINKS[400],
      title: 'The request is not valid.',
      status: 400,
      instance,
    };
    // Extension properties follow the base members, preserving .NET's
    // ValidationProblemDetails serialisation order.
    body.errors = error.errors;
    writeProblem(res, 400, body);
    return;
  }

  if (error instanceof NotFoundError) {
    logger.info('%s %s', error.name, error.message);
    writeProblem(res, 404, {
      type: STATUS_LINKS[404],
      title: `${error.resourceName} not found.`,
      status: 404,
      detail: error.message,
      instance,
    });
    return;
  }

  if (error instanceof DomainError) {
    logger.debug('Domain rule violated: %s', error.message);
    writeProblem(res, 422, {
      type: STATUS_LINKS[422],
      title: 'The content violates a business rule.',
      status: 422,
      detail: error.message,
      instance,
    });
    return;
  }

  if (error instanceof ConflictError) {
    logger.debug('Write conflict: %s', error.message);
    writeProblem(res, 409, {
      type: STATUS_LINKS[409],
      title: 'The write conflicts with existing data.',
      status: 409,
      detail: error.message,
      instance,
    });
    return;
  }

  if (error instanceof ForbiddenError) {
    logger.info('Forbidden: %s', error.message);
    writeProblem(res, 403, {
      type: STATUS_LINKS[403],
      title: 'Not allowed.',
      status: 403,
      detail: error.message,
      instance,
    });
    return;
  }

  // Everything else is a bug or an outage: log it, tell the client nothing.
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  logger.error(
    { err: detail, method: req.method, path: req.originalUrl, traceId: traceOf(req) },
    'Unhandled exception while processing request',
  );

  writeProblem(res, 500, {
    type: STATUS_LINKS[500],
    title: 'An unexpected error occurred.',
    status: 500,
    detail: 'The error has been logged. Please try again later.',
    instance,
  });
}
