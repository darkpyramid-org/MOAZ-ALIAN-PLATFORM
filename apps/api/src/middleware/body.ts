import type { NextFunction, Request, Response } from 'express';

/**
 * Body binding with System.Text.Json's exact semantics — this is the piece that
 * decides between the wire's 400 / 415 / 500 split, so it mirrors STJ closely:
 *
 *   - content-type not JSON (application/json, text/json, application/*+json)
 *     → 415, an EMPTY body (UseStatusCodePages rendered the status page);
 *   - empty body, malformed JSON, wrong property types, a `required` member
 *     absent, or a bad enum NAME string → JsonException → BadHttpRequestException
 *     → GlobalExceptionHandler's default branch → the generic 500 problem;
 *   - null for a string/nullable property binds fine and the ENDPOINT's own
 *     blank-check turns it into a 400;
 *   - enum NUMBERS bind even when out of range (99 becomes the enum value and
 *     FluentValidation's IsInEnum 400s it);
 *   - numeric STRINGS bind to numbers (Web defaults allow reading numbers from
 *     strings), and property-name matching is case-insensitive.
 *
 * Everything the binder rejects becomes a BindFailure; the error handler alone
 * decides the wire response.
 */

/** Mirrors the exception the ASP.NET binder raises for malformed/wrong-typed bodies. */
export class BindFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BindFailure';
  }
}

/** Non-JSON content type — 415, distinct from the 500 paths above. */
export class UnsupportedMediaTypeFailure extends Error {
  constructor(contentType: string) {
    super(`Unsupported content type '${contentType}'.`);
    this.name = 'UnsupportedMediaTypeFailure';
  }
}

const MAX_BODY_BYTES = 30 * 1024 * 1024; // Kestrel's MaxRequestBodySize default

interface RawRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Buffers the request body once, before any route reads it. A single eager
 * read (express.raw with a catch-all type) keeps the JSON parsing decision in
 * the binder instead of the body-parser config, and gives the settings PUT —
 * which stores the raw text byte-for-byte — exactly what it received.
 */
export function collectRawBody(req: RawRequest, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let aborted = false;

  req.on('data', (chunk: Buffer) => {
    if (aborted) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      aborted = true;
      // Kestrel answers an oversized body with 413 and closes the request side.
      res.status(413).set('connection', 'close');
      res.end();
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!aborted) {
      req.rawBody = Buffer.concat(chunks);
      next();
    }
  });
  req.on('error', (error: NodeJS.ErrnoException) => {
    // Client disconnects mid-body are transport noise, not API errors.
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') return;
    next(error);
  });
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface RawRequestWithJson extends RawRequest {
  bodyJson?: Json;
  rawBodyText?: string;
}

/** True for the content types the ASP.NET JSON binder accepts. */
function isJsonContentType(headerValue: string | undefined): boolean {
  if (headerValue === undefined) return false;
  const mediaType = headerValue.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    mediaType === 'application/json' ||
    mediaType === 'text/json' ||
    (mediaType.startsWith('application/') && mediaType.endsWith('+json'))
  );
}

/**
 * Parses the body as JSON of any shape (the [FromBody] JsonElement path used by
 * the settings PUT, which must round-trip the caller's exact bytes).
 * Returns { raw, json } or throws.
 */
export function bindRawJson(req: RawRequestWithJson): { raw: string; json: Json } {
  requireBody(req);
  const raw = (req as RawRequestWithJson).rawBodyText as string;
  const parsed = JSON.parse(raw) as Json;
  return { raw, json: parsed };
}

function requireBody(req: RawRequestWithJson): void {
  if (req.rawBody === undefined) {
    req.rawBody = Buffer.alloc(0);
  }
  const contentType = req.headers['content-type'];

  if (req.rawBody.length > 0 && !isJsonContentType(contentType as string | undefined)) {
    // A body arrived under a non-JSON media type: the binder refuses it with a
    // bare 415 (empty response), which the status-page pass then renders.
    throw new UnsupportedMediaTypeFailure(String(contentType ?? ''));
  }

  if (req.rawBody.length === 0) {
    // Empty body under JSON content type (or none): STJ throws
    // "The input does not contain any JSON tokens" → the generic 500 problem.
    throw new BindFailure('The input does not contain any JSON tokens.');
  }

  if (req.bodyJson === undefined) {
    try {
      req.bodyJson = JSON.parse(req.rawBody.toString('utf8')) as Json;
      req.rawBodyText = req.rawBody.toString('utf8');
    } catch (error) {
      throw new BindFailure(`Failed to parse JSON: ${(error as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Field specs — one declarative table per request type keeps every binding
// decision next to the contract it mirrors.
// ---------------------------------------------------------------------------

export type FieldKind =
  | 'string' // string? or non-nullable reference: null binds (endpoint 400s later)
  | 'boolean' // value type: null or wrong type fails, absent → false
  | 'number' // value type int/long: numeric strings allowed (Web defaults)
  | 'stringArray' // string[]?: elements must be strings (null elements OK)
  | 'linksArray' // AuthorizedLink[]?: { label, url } pairs, deep-checked
  | 'date' // DateTimeOffset?: ISO string with an explicit offset required
  | 'rawJson' // JsonElement: any JSON value binds
  | 'enum'; // JsonStringEnumConverter(camelCase): name or integer binds

export interface FieldSpec {
  key: string;
  kind: FieldKind;
  /** Mirrors C# `required`: an absent property is a binding failure (500). */
  required?: boolean;
}

export type BoundBody = Record<string, unknown>;

/**
 * Binds the body against the spec. The lookup is case-insensitive first (STJ's
 * Web default) so "Email" binds to `email` exactly like the original.
 */
export function bindBody(req: RawRequestWithJson, spec: readonly FieldSpec[]): BoundBody {
  requireBody(req);

  const root = req.bodyJson as Json;
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    // STJ: a scalar body cannot fill a record constructor → JsonException → 500.
    throw new BindFailure('The JSON value could not be converted to the request type.');
  }

  const source = root as { [key: string]: Json };
  const bound: BoundBody = {};

  for (const field of spec) {
    const value = pickProperty(source, field.key);
    if (value === undefined) {
      if (field.required === true) {
        throw new BindFailure(`Missing required property '${field.key}'.`);
      }
      bound[field.key] = undefined; // callers treat absent == null per STJ defaults
      continue;
    }
    bound[field.key] = coerce(field, value);
  }

  return bound;
}

/** STJ property matching: exact key first, then a case-insensitive fallback. */
function pickProperty(source: { [key: string]: Json }, key: string): Json | undefined {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  const lowered = key.toLowerCase();
  for (const name of Object.keys(source)) {
    if (name.toLowerCase() === lowered) {
      return source[name];
    }
  }
  return undefined;
}

function coerce(field: FieldSpec, value: Json): unknown {
  switch (field.kind) {
    case 'string': {
      if (value === null) return null;
      if (typeof value !== 'string') {
        throw new BindFailure(`The JSON value could not be converted to String. Path: $.${field.key}`);
      }
      return value;
    }

    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new BindFailure(`The JSON value could not be converted to Boolean. Path: $.${field.key}`);
      }
      return value;
    }

    case 'number': {
      if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
          // Int-typed CLR properties refuse fractional values outright.
          throw new BindFailure(`The JSON value could not be converted to Int32. Path: $.${field.key}`);
        }
        return value;
      }
      if (typeof value === 'string') {
        // Web defaults: AllowReadingFromString. Whitespace is tolerated; the
        // value must still be an exact integer in Int32 range.
        const trimmed = value.trim();
        if (/^[+-]?\d+$/.test(trimmed)) {
          const parsed = Number(trimmed);
          if (Number.isSafeInteger(parsed) && parsed >= -2_147_483_648 && parsed <= 2_147_483_647) {
            return parsed;
          }
        }
      }
      throw new BindFailure(`The JSON value could not be converted to Int32. Path: $.${field.key}`);
    }

    case 'stringArray': {
      if (value === null) return null;
      if (!Array.isArray(value)) {
        throw new BindFailure(`The JSON value could not be converted to String[]. Path: $.${field.key}`);
      }
      return value.map((entry) => {
        if (entry === null) return null;
        if (typeof entry !== 'string') {
          throw new BindFailure(`The JSON value could not be converted to String. Path: $.${field.key}`);
        }
        return entry;
      });
    }

    case 'linksArray': {
      if (value === null) return null;
      if (!Array.isArray(value)) {
        throw new BindFailure(`The JSON value could not be converted to AuthorizedLink[]. Path: $.${field.key}`);
      }
      return value.map((entry) => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          throw new BindFailure(`The JSON value could not be converted to AuthorizedLink. Path: $.${field.key}`);
        }
        const pair = entry as { [key: string]: Json };
        const label = pairProperty(pair, 'label');
        const url = pairProperty(pair, 'url');
        for (const [name, member] of [['label', label], ['url', url]] as const) {
          if (member !== undefined && member !== null && typeof member !== 'string') {
            throw new BindFailure(`The JSON value could not be converted to String. Path: $.${field.key}.${name}`);
          }
        }
        return { label: label ?? null, url: url ?? null };
      });
    }

    case 'date': {
      if (value === null) return null;
      if (typeof value !== 'string') {
        throw new BindFailure(`The JSON value could not be converted to DateTimeOffset. Path: $.${field.key}`);
      }
      // DateTimeOffset NEEDS an explicit offset — a bare local time is not a
      // valid value on the .NET side either.
      if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) {
        throw new BindFailure(`The JSON value could not be converted to DateTimeOffset. Path: $.${field.key}`);
      }
      const parsed = new Date(value.trim());
      if (Number.isNaN(parsed.getTime())) {
        throw new BindFailure(`The JSON value could not be converted to DateTimeOffset. Path: $.${field.key}`);
      }
      return parsed;
    }

    case 'rawJson': {
      return value;
    }
  }
}

function pairProperty(pair: { [key: string]: Json }, key: string): Json | undefined {
  if (Object.prototype.hasOwnProperty.call(pair, key)) return pair[key];
  const lowered = key.toLowerCase();
  for (const name of Object.keys(pair)) {
    if (name.toLowerCase() === lowered) return pair[name];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Enum binding. JsonStringEnumConverter(camelCase) reads names
// case-insensitively and refuses unknown names (JsonException → 500), but
// accepts ANY integer (out-of-range values flow to the validator → 400).
// ---------------------------------------------------------------------------

export interface EnumFieldSpec extends FieldSpec {
  kind: 'enum';
  /** camelCase wire names, in declaration order. */
  names: readonly string[];
  /** Numeric values, same positions as `names`. */
  values: readonly number[];
}

export function bindEnumBody(
  req: RawRequestWithJson,
  spec: readonly (FieldSpec | EnumFieldSpec)[],
): BoundBody {
  requireBody(req);

  const root = req.bodyJson as Json;
  if (root === null || typeof root !== 'object' || Array.isArray(root)) {
    throw new BindFailure('The JSON value could not be converted to the request type.');
  }

  const source = root as { [key: string]: Json };
  const bound: BoundBody = {};

  for (const field of spec) {
    const value = pickProperty(source, field.key);
    if (value === undefined) {
      if (field.required === true) {
        throw new BindFailure(`Missing required property '${field.key}'.`);
      }
      bound[field.key] = undefined;
      continue;
    }

    if (field.kind === 'enum') {
      bound[field.key] = coerceEnum(field as EnumFieldSpec, value);
      continue;
    }
    bound[field.key] = coerce(field, value);
  }

  return bound;
}

function coerceEnum(field: EnumFieldSpec, value: Json): number | null {
  if (value === null) return null;

  if (typeof value === 'number') {
    // Integers bind even out of range (validator's IsInEnum reports them);
    // fractional values are a conversion failure.
    if (!Number.isInteger(value)) {
      throw new BindFailure(`The JSON value could not be converted to the enum type. Path: $.${field.key}`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    const index = field.names.findIndex((name) => name.toLowerCase() === lowered);
    if (index !== -1) return field.values[index] ?? null;
    // Unknown NAME (not a number): the converter throws, which surfaces as 500.
    throw new BindFailure(`The JSON value could not be converted to the enum type. Path: $.${field.key}`);
  }

  throw new BindFailure(`The JSON value could not be converted to the enum type. Path: $.${field.key}`);
}

/** Query-string scalar parsing with .NET binder semantics (int?/bool? params). */
export function parseOptionalInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const trimmed = raw.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    throw new BindFailure(`Failed to bind query value '${raw}'.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < -2_147_483_648 || parsed > 2_147_483_647) {
    throw new BindFailure(`Failed to bind query value '${raw}'.`);
  }
  return parsed;
}

/** bool.TryParse: only true/false, any casing — never "1"/"0". */
export function parseOptionalBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  throw new BindFailure(`Failed to bind query value '${raw}'.`);
}
