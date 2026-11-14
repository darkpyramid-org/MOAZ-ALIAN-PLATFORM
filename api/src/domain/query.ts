import type { ContentType } from './enums.js';

/**
 * Port of Application.Contracts.Content.ContentQuery and the WebApi's
 * ContentQueryRequest translation (query string → typed query).
 */

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 200;

/** Ordering options, named to match the frontend's SortKey values. */
export const CONTENT_SORTS = ['newest', 'oldest', 'title', 'relevance'] as const;
export type ContentSort = 0 | 1 | 2 | 3;

export const ContentSort = {
  Newest: 0,
  Oldest: 1,
  Title: 2,
  Relevance: 3,
} as const;

export interface ContentQuery {
  type: ContentType | null;
  categoryId: string | null;
  search: string | null;
  series: string | null;
  featured: boolean | null;
  demo: boolean | null;
  sort: ContentSort;
  page: number;
  pageSize: number;
}

/**
 * Normalised form used for cache keys and paging — page floors at 1, page size
 * clamps to [1, 100] (an oversized page shrinks instead of failing), and blank
 * filters become null. Page itself is NOT clamped from above: ?page=99 past the
 * end simply returns an empty items array with page:99 (observed contract).
 */
export function normalizeQuery(query: ContentQuery): ContentQuery {
  return {
    ...query,
    page: query.page < 1 ? 1 : query.page,
    pageSize:
      query.pageSize < 1 ? DEFAULT_PAGE_SIZE : query.pageSize > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : query.pageSize,
    search: query.search === null || query.search.trim() === '' ? null : query.search.trim(),
    categoryId: query.categoryId === null || query.categoryId.trim() === '' ? null : query.categoryId.trim(),
    series: query.series === null || query.series.trim() === '' ? null : query.series.trim(),
  };
}

/** Structural input so both the domain ContentQuery and the reader's
 * NormalizedQuery satisfy one key builder. */
export interface QueryKeyInput {
  type: number | null;
  categoryId: string | null;
  series: string | null;
  featured: boolean | null;
  demo: boolean | null;
  sort: number;
  page: number;
  pageSize: number;
  search: string | null;
}

/**
 * Cache key for a normalised query — stable ordering of the optional parts means
 * two equivalent requests always hit one entry (port of BuildQueryKey).
 */
export function buildQueryKey(query: QueryKeyInput, cacheVersion: number): string {
  const typeCode = query.type ?? 0;
  const featuredFlag = query.featured === true ? 1 : 0;
  const demoFlag = query.demo === true ? 1 : 0;
  const sortCode = query.sort;
  return `content:q:v${cacheVersion}|t=${typeCode}|c=${query.categoryId}|s=${query.series}|f=${featuredFlag}|d=${demoFlag}|o=${sortCode}|p=${query.page}|z=${query.pageSize}|q=${query.search}`;
}

/**
 * Enum.TryParse(ignoreCase) semantics, ported exactly:
 *   - the camelCase wire names AND the CLR member names both match, any casing
 *     ("Video", "BOOKS" fails — it is not a member);
 *   - numeric strings bind ONLY when they name a defined value (Enum.IsDefined
 *     gates the result, so "?type=99" is a reported error, not a silent filter);
 *   - anything else is a field-level 400 whose hint lists the camelCase names,
 *     because that is the wire format a client can actually send.
 * Result-object on purpose: the route turns the failure into a field-level
 * 400, not an exception thrown from a parser.
 */
export interface EnumParseResult<T> {
  ok: boolean;
  value: T | null;
  message?: string;
}

export function parseQueryEnum<T extends number>(
  field: string,
  raw: string | null | undefined,
  names: readonly string[],
  values: readonly (T | null)[],
  clrNames: readonly string[] = [],
): EnumParseResult<T> {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { ok: true, value: null };
  }

  const lowered = raw.trim().toLowerCase();
  const byName = (list: readonly string[]): number => list.findIndex((name) => name.toLowerCase() === lowered);
  let index = byName(names);
  if (index === -1) index = byName(clrNames);

  if (index === -1 && /^[+-]?\d+$/.test(lowered)) {
    // Numeric strings go through Enum.TryParse + IsDefined: only defined
    // values survive, anything else reports the same one-of hint.
    const numeric = Number(lowered);
    const valueIndex = values.findIndex((value) => value === numeric);
    if (valueIndex !== -1) {
      return { ok: true, value: values[valueIndex] ?? null };
    }
    index = -1;
  }

  if (index === -1) {
    return { ok: false, value: null, message: `${field} must be one of: ${names.join(', ')}.` };
  }
  const value = values[index];
  return { ok: true, value: value === undefined ? null : value };
}
