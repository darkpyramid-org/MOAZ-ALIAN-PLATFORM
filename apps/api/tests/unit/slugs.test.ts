import { describe, expect, it } from 'vitest';
import { normalizeSlug, requireSlug, MAX_SLUG_LENGTH } from '../../src/lib/slugs.js';

describe('normalizeSlug — port of Domain.Common.Slugs', () => {
  it('preserves Arabic letters and digits, collapses separators', () => {
    expect(normalizeSlug('فيديو-تجريبي للاختبار')).toBe('فيديو-تجريبي-للاختبار');
  });

  it('trims and lowercases like the original', () => {
    expect(normalizeSlug('  AbC  ')).toBe('abc');
  });

  it('collapses punctuation runs into single hyphens and trims edge hyphens', () => {
    expect(normalizeSlug('--Hello,   World!!--')).toBe('hello-world');
  });

  it('returns the empty string for blank or separator-only input', () => {
    expect(normalizeSlug('')).toBe('');
    expect(normalizeSlug('   ')).toBe('');
    expect(normalizeSlug('---')).toBe('');
  });

  it('rejects empty slugs with the domain error', () => {
    expect(() => requireSlug('')).toThrowError('Slug must contain at least one letter or digit.');
  });

  it('truncates on a hyphen boundary to the maximum length', () => {
    expect(normalizeSlug('x'.repeat(MAX_SLUG_LENGTH + 10))).toHaveLength(MAX_SLUG_LENGTH);
  });
});
