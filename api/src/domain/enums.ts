/**
 * The four library shapes the frontend renders — port of Domain.Enums.
 * Persisted as smallints; the API serialises the lower-case (camelCase) name
 * the frontend's union types already expect (JsonStringEnumConverter +
 * camelCase naming policy).
 */

export const CONTENT_TYPES = [1, 2, 3, 4] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const ContentType = {
  Video: 1,
  Book: 2,
  Article: 3,
  Research: 4,
} as const;

/** camelCase JSON names, in enum declaration order (drives validation hints). */
export const CONTENT_TYPE_NAMES = ['video', 'book', 'article', 'research'] as const;

/** CLR member names — conflict messages interpolate the enum itself
 * (`$"A {draft.Type} record…"`) so "Video" appears, not "video". */
export const CONTENT_TYPE_CLR_NAMES = ['Video', 'Book', 'Article', 'Research'] as const;

export function contentTypeName(value: ContentType): string {
  return CONTENT_TYPE_NAMES[(value - 1) as 0 | 1 | 2 | 3];
}

export function contentTypeClrName(value: ContentType): string {
  return CONTENT_TYPE_CLR_NAMES[(value - 1) as 0 | 1 | 2 | 3];
}

/**
 * Enum.TryParse(name, ignoreCase) — CLR member names, case-insensitively.
 * "books" fails (no such member); "Book" and "BOOK" succeed.
 */
export function parseContentType(raw: string | null | undefined): ContentType | undefined {
  if (raw === null || raw === undefined) return undefined;
  const lowered = raw.trim().toLowerCase();
  switch (lowered) {
    case 'video':
      return ContentType.Video;
    case 'book':
      return ContentType.Book;
    case 'article':
      return ContentType.Article;
    case 'research':
      return ContentType.Research;
    default:
      return undefined;
  }
}

export const RIGHTS_STATUSES = [1, 2, 3, 4] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const RightsStatus = {
  Owned: 1,
  Licensed: 2,
  External: 3,
  Unknown: 4,
} as const;

export const RIGHTS_STATUS_NAMES = ['owned', 'licensed', 'external', 'unknown'] as const;

export function rightsStatusName(value: RightsStatus): string {
  return RIGHTS_STATUS_NAMES[(value - 1) as 0 | 1 | 2 | 3];
}

export function parseRightsStatus(raw: string | number | null | undefined): RightsStatus | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && (RIGHTS_STATUSES as readonly number[]).includes(raw) ? (raw as RightsStatus) : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const lowered = raw.trim().toLowerCase();
  const index = RIGHTS_STATUS_NAMES.indexOf(lowered as (typeof RIGHTS_STATUS_NAMES)[number]);
  return index === -1 ? undefined : ((index + 1) as RightsStatus);
}

export const VIDEO_PROVIDERS = [1] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const VideoProvider = {
  Youtube: 1,
} as const;

/** Spelled "Youtube" so camelCase serialisation produces exactly "youtube". */
export const VIDEO_PROVIDER_NAMES = ['youtube'] as const;

export function videoProviderName(value: VideoProvider): string {
  return VIDEO_PROVIDER_NAMES[(value - 1) as 0];
}

export function parseVideoProvider(raw: string | number | null | undefined): VideoProvider | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && (VIDEO_PROVIDERS as readonly number[]).includes(raw) ? (raw as VideoProvider) : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const lowered = raw.trim().toLowerCase();
  const index = VIDEO_PROVIDER_NAMES.indexOf(lowered as (typeof VIDEO_PROVIDER_NAMES)[number]);
  return index === -1 ? undefined : ((index + 1) as VideoProvider);
}

export const BOOK_AVAILABILITIES = [1, 2, 3] as const;
export type BookAvailability = (typeof BOOK_AVAILABILITIES)[number];

export const BookAvailability = {
  Digital: 1,
  Print: 2,
  Unknown: 3,
} as const;

export const BOOK_AVAILABILITY_NAMES = ['digital', 'print', 'unknown'] as const;

export function bookAvailabilityName(value: BookAvailability): string {
  return BOOK_AVAILABILITY_NAMES[(value - 1) as 0 | 1 | 2];
}

export function parseBookAvailability(raw: string | number | null | undefined): BookAvailability | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && (BOOK_AVAILABILITIES as readonly number[]).includes(raw)
      ? (raw as BookAvailability)
      : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const lowered = raw.trim().toLowerCase();
  const index = BOOK_AVAILABILITY_NAMES.indexOf(lowered as (typeof BOOK_AVAILABILITY_NAMES)[number]);
  return index === -1 ? undefined : ((index + 1) as BookAvailability);
}
