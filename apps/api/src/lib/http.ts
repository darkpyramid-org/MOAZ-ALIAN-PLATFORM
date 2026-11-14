import type { Request, Response } from 'express';
import { httpJson } from './netjson.js';

/**
 * Response helpers reproducing the ASP.NET wire format byte for byte.
 *
 * Three JSON surfaces with three different bodies for the same status code:
 *   1. Framework results (Results.Ok/BadRequest/Created, WriteAsJsonAsync):
 *      content-type "application/json; charset=utf-8", raw non-ASCII (the
 *      framework serialiser does not escape above U+007E).
 *   2. Results.Problem: content-type "application/problem+json", RAW non-ASCII
 *      but with an RFC 9110 type link and a traceId extension — .NET only
 *      assigns defaults for a fixed set of well-known statuses (400–500; 501
 *      gets no type link and falls back to the reason phrase).
 *   3. GlobalExceptionHandler problems: content-type "application/problem+json",
 *      type links "https://httpstatuses.com/{status}", NO traceId, and the
 *      ASCII-safe serialiser (non-ASCII → \uXXXX uppercase, ' < > & + escaped).
 *
 * Status pages (bare 401/403/404/415/429 with no body) are written by the
 * StatusCodePages middleware: content-type "application/json; charset=utf-8"
 * with {title, status, traceId}.
 */

/** Per-request trace id in the ASP.NET shape "connectionId:requestNumber". */
export interface TraceContext {
  traceId: string;
}

const RFC9110_TYPE_LINKS: Record<number, string> = {
  400: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
  401: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
  403: 'https://tools.ietf.org/html/rfc9110#section-15.5.3',
  404: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
  405: 'https://tools.ietf.org/html/rfc9110#section-15.5.7',
  406: 'https://tools.ietf.org/html/rfc9110#section-15.5.8',
  409: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
  410: 'https://tools.ietf.org/html/rfc9110#section-15.5.9',
  411: 'https://tools.ietf.org/html/rfc9110#section-15.5.11',
  412: 'https://tools.ietf.org/html/rfc9110#section-15.5.13',
  413: 'https://tools.ietf.org/html/rfc9110#section-15.5.14',
  415: 'https://tools.ietf.org/html/rfc9110#section-15.5.16',
  422: 'https://tools.ietf.org/html/rfc9110#section-15.5.21',
  500: 'https://tools.ietf.org/html/rfc9110#section-15.6.1',
};

const REASON_PHRASES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
};

const JSON_CT = 'application/json; charset=utf-8';
const PROBLEM_CT = 'application/problem+json';

/** Framework-style JSON body (Results.Ok and friends). Nulls stay nulls. */
export function sendJson(res: Response, status: number, body: unknown): void {
  res.status(status).set('content-type', JSON_CT).send(httpJson(body));
}

/** 201 with an ASCII-safe Location header (Arabic slugs are percent-encoded by the caller). */
export function sendCreated(res: Response, location: string, body: unknown): void {
  res.status(201).set('content-type', JSON_CT).set('location', location).send(httpJson(body));
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function sendRedirect(res: Response, location: string, status = 302): void {
  res.status(status).set('location', location).end();
}

/**
 * Results.Problem: rfc9110 type link for well-known statuses, traceId
 * extension, raw serialisation. Title falls back to the HTTP reason phrase —
 * observed on the 501 "Provider not configured." path.
 */
export function sendProblemFramework(
  res: Response,
  statusCode: number,
  options: { title?: string; detail?: string },
  traceId: string,
): void {
  const type = RFC9110_TYPE_LINKS[statusCode];
  const body: Record<string, unknown> = {};
  if (type !== undefined) body.type = type;
  body.title = options.title ?? REASON_PHRASES[statusCode] ?? `Status ${statusCode}`;
  body.status = statusCode;
  if (options.detail !== undefined && options.detail !== null) body.detail = options.detail;
  body.traceId = traceId;

  res.status(statusCode).set('content-type', PROBLEM_CT).send(httpJson(body));
}

/** StatusCodePages shape for bare 4xx/5xx responses (auth challenges, 415, 429, 404s). */
const STATUS_PAGE_TITLES: Record<number, string> = {
  401: 'Authentication required.',
  403: 'Not allowed.',
  404: 'Not found.',
  429: 'Too many requests.',
};

export function sendStatusPage(res: Response, statusCode: number, traceId: string): void {
  const title = STATUS_PAGE_TITLES[statusCode] ?? `Request failed with status ${statusCode}.`;
  res
    .status(statusCode)
    .set('content-type', JSON_CT)
    .send(httpJson({ title, status: statusCode, traceId }));
}

/** 401 challenge: status-page body + Bearer WWW-Authenticate (with error detail on bad tokens). */
export function sendUnauthorizedChallenge(res: Response, traceId: string, error?: string): void {
  res.status(401).set('www-authenticate', error === undefined ? 'Bearer' : `Bearer error="${error}"`);
  sendStatusPage(res, 401, traceId);
}

export function traceOf(req: Request & { traceId?: string }): string {
  return req.traceId ?? '0000000000000:00000000';
}
