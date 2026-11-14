import { DomainError } from './errors.js';

/**
 * URL identifier generation — port of Domain.Common.Slugs. Arabic letters and
 * digits are preserved (the platform's slugs are Arabic); every other run of
 * characters collapses into single hyphens.
 *
 * \p{L} and \p{Nd} are Unicode categories shared by .NET and ECMAScript's /u
 * mode, so the same characters survive on both runtimes.
 */
export const MAX_SLUG_LENGTH = 200;

const UNSUPPORTED_RUNS = /[^\p{L}\p{Nd}]+/gu;
const EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Returns a normalised slug, or the empty string when nothing usable remains
 * (for example a slug made only of punctuation).
 */
export function normalizeSlug(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return '';
  }

  const lowered = raw.trim().toLowerCase();
  const hyphenated = lowered.replace(UNSUPPORTED_RUNS, '-');
  const trimmed = hyphenated.replace(EDGE_HYPHENS, '');

  if (trimmed.length === 0) {
    return '';
  }

  // The trailing TrimEnd('-') matters: truncating on a hyphen boundary must not
  // leave a dangling separator on the generated id.
  return trimmed.length > MAX_SLUG_LENGTH ? trimmed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '') : trimmed;
}

/** Normalises and guarantees a usable slug, rejecting input that cannot produce one. */
export function requireSlug(raw: string | null | undefined): string {
  const normalized = normalizeSlug(raw);
  if (normalized.length === 0) {
    throw new DomainError('Slug must contain at least one letter or digit.');
  }
  return normalized;
}
