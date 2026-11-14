import { DomainError } from './errors.js';

/**
 * Invariant checks for values entering an aggregate — port of Domain.Common.Guard.
 * Every message is reproduced exactly: the API surfaces these strings to editors
 * and the frontend displays them verbatim.
 */

/** Rejects null/whitespace and over-length input; returns the trimmed value. */
export function guardRequired(value: string | null | undefined, name: string, maxLength: number): string {
  if (value === null || value === undefined || value.trim() === '') {
    throw new DomainError(`${name} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new DomainError(`${name} must be at most ${maxLength} characters (got ${trimmed.length}).`);
  }

  return trimmed;
}

/** Trims and nullifies blank optional text, so "" is never stored. */
export function guardOptional(value: string | null | undefined, maxLength: number, name: string): string | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new DomainError(`${name} must be at most ${maxLength} characters (got ${trimmed.length}).`);
  }

  return trimmed;
}

/**
 * Enum sanity check. The numeric value is rendered the way C# formats an
 * out-of-range enum ("99"), matching Guard.Enum's interpolation.
 */
export function guardEnum<T extends number>(value: T | null | undefined, allowed: readonly T[], name: string): T {
  if (value === null || value === undefined || !allowed.includes(value)) {
    throw new DomainError(`${name} has an unsupported value (${value === undefined ? '' : value}).`);
  }
  return value;
}

export function guardRange(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
  name: string,
): void {
  if (value !== null && value !== undefined && (value < minimum || value > maximum)) {
    throw new DomainError(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

/**
 * Validates an absolute http(s) URL. An absolute URL is one with a scheme —
 * "example.com" (no scheme) is rejected, matching Uri.TryCreate(UriKind.Absolute).
 * Internationalised and query-heavy media links parse fine in both runtimes.
 */
export function guardUrl(value: string | null | undefined, name: string, maxLength: number): string | null {
  const trimmed = guardOptional(value, maxLength, name);
  if (trimmed === null) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DomainError(`${name} must be a valid absolute http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DomainError(`${name} must be a valid absolute http(s) URL.`);
  }

  return trimmed;
}

/**
 * Removes duplicates without reordering, comparing case-insensitively so tags
 * behave consistently regardless of how the database collation sorts them.
 * Each element passes Guard.Required first, so a blank entry fails loudly.
 */
export function guardDistinctValues(
  values: readonly (string | null | undefined)[],
  name: string,
  maxLength: number,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = guardRequired(raw, name, maxLength);
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}
