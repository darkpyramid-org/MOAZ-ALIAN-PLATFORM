import {
  BOOK_AVAILABILITIES,
  CONTENT_TYPES,
  ContentType,
  RIGHTS_STATUSES,
  RightsStatus,
  VIDEO_PROVIDERS,
  type BookAvailability,
  type VideoProvider,
  bookAvailabilityName,
  contentTypeName,
  parseRightsStatus,
  parseVideoProvider,
  rightsStatusName,
  videoProviderName,
} from './enums.js';
import { DomainError } from '../lib/errors.js';
import {
  guardDistinctValues,
  guardEnum,
  guardOptional,
  guardRange,
  guardRequired,
  guardUrl,
} from '../lib/guard.js';
import { randomBytes } from 'node:crypto';
import { normalizeSlug, requireSlug } from '../lib/slugs.js';
import { netTimestamp } from '../lib/netjson.js';

/**
 * Port of Domain.Entities.ContentItem: the aggregate root owns every invariant
 * a content record must satisfy. Validation runs BEFORE any assignment so a
 * rejected draft leaves no partial state — on the wire this is what separates
 * a 422 (broken invariant) from a 400 (malformed shape).
 */

export const ID_MAX_LENGTH = 100;
export const TITLE_MAX_LENGTH = 300;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const BODY_MAX_LENGTH = 100_000;
export const TAGS_MAX_LENGTH = 40;
export const MAX_TAGS = 60;
export const MAX_REFERENCES = 100;
export const MAX_AUTHORIZED_LINKS = 20;
export const MAX_DURATION_SECONDS = 86_400;
const SHORT_TEXT_MAX_LENGTH = 200;
const URL_MAX_LENGTH = 2048;

const ISBN_PATTERN = /^(?:[0-9]{9}[0-9Xx]|[0-9]{13})$/;

export interface AuthorizedLinkInput {
  label?: string | null;
  url?: string | null;
}

export interface AuthorizedLink {
  label: string;
  url: string;
}

/** Raw link pair as supplied by a caller; validated when the aggregate consumes it. */
export function createAuthorizedLink(label: string | null | undefined, url: string | null | undefined): AuthorizedLink {
  const validLabel = guardRequired(label, 'Link label', 120);
  const validUrl = guardUrl(url, 'Link url', URL_MAX_LENGTH);
  if (validUrl === null) {
    throw new DomainError('Link url is required.');
  }
  return { label: validLabel, url: validUrl };
}

export interface ContentItemDraft {
  type: ContentType;
  slug: string | null;
  title: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  authorName?: string | null;
  sourceUrl?: string | null;
  body?: string | null;
  tags?: (string | null)[] | null;
  featured: boolean;
  verified: boolean;
  demo: boolean;
  rightsStatus: RightsStatus;
  publishedAt?: Date | null;
  videoId?: string | null;
  videoProvider?: VideoProvider | null;
  durationSeconds?: number | null;
  seriesName?: string | null;
  coverUrl?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  publicationYear?: number | null;
  availability?: BookAvailability | null;
  authorizedLinks?: AuthorizedLinkInput[] | null;
  readingTimeMinutes?: number | null;
  references?: (string | null)[] | null;
  documentUrl?: string | null;
  documentFormat?: string | null;
}

/**
 * The full editable state of one record, already validated — this is exactly
 * what gets persisted and what the detail projection reads back.
 */
export interface ContentItemState {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  body: string | null;
  tags: string[];
  featured: boolean;
  verified: boolean;
  demo: boolean;
  rightsStatus: RightsStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  videoId: string | null;
  videoProvider: VideoProvider | null;
  durationSeconds: number | null;
  seriesName: string | null;
  coverUrl: string | null;
  publisher: string | null;
  isbn: string | null;
  publicationYear: number | null;
  availability: BookAvailability | null;
  authorizedLinks: AuthorizedLink[];
  readingTimeMinutes: number | null;
  references: string[];
  documentUrl: string | null;
  documentFormat: string | null;
}

/** Resolves the URL identifier a draft will end up with — same rule the aggregate applies. */
export function resolveSlug(slug: string | null | undefined, title: string | null | undefined): string {
  return requireSlug(slug === null || slug === undefined || slug.trim() === '' ? title : slug);
}

/**
 * Generates a readable id from the title, matching the frontend's text-id
 * convention: normalised title + '-' + 8 lowercase hex characters (the first
 * 8 nibbles of a GUID "N" format).
 */
export function newId(title: string | null | undefined): string {
  const baseSlug = normalizeSlug(title);
  const suffix = randomBytes(4).toString('hex'); // 8 hex chars, matches Guid "N" prefix
  return baseSlug.length === 0 ? suffix : `${baseSlug}-${suffix}`;
}

function normalizeIsbn(raw: string | null | undefined): string | null {
  const candidate = guardOptional(raw, 32, 'ISBN');
  if (candidate === null) {
    return null;
  }

  const compact = candidate
    .split('')
    .filter((character) => /\s/.test(character) === false && character !== '-')
    .join('');

  if (compact.length === 0 || !ISBN_PATTERN.test(compact)) {
    throw new DomainError('ISBN must be 10 or 13 digits (the final digit of a 10-digit ISBN may be X).');
  }

  return compact.toUpperCase();
}

/** Validates the draft in full before any field is written (ContentItem.Validate). */
function validateDraft(draft: ContentItemDraft): void {
  guardRange(draft.durationSeconds, 0, MAX_DURATION_SECONDS, 'Duration seconds');
  guardRange(draft.readingTimeMinutes, 0, 10_000, 'Reading time minutes');
  guardRange(draft.publicationYear, 800, 2100, 'Publication year');

  if (draft.publishedAt !== null && draft.publishedAt !== undefined && draft.publishedAt.getUTCFullYear() < 800) {
    throw new DomainError('Published date looks implausible; use a full date (year 800 or later).');
  }

  // Metadata-only records are the platform's safe default, but they are useless
  // without somewhere to send the reader.
  if (draft.rightsStatus === RightsStatus.External && (draft.sourceUrl === null || draft.sourceUrl === undefined || draft.sourceUrl.trim() === '')) {
    throw new DomainError('Externally sourced records require a source URL so the reader can be sent to the publisher.');
  }

  switch (draft.type) {
    case ContentType.Video:
      if (draft.videoId !== null && draft.videoId !== undefined && draft.videoId.trim() !== '' && draft.videoProvider === null) {
        throw new DomainError('A video ID requires a video provider.');
      }
      break;

    case ContentType.Book:
      // ISBN shape is checked once, in normalizeIsbn, while the field is assigned.
      break;

    case ContentType.Article:
      // Mirrors the frontend contract: a null body means an external article
      // whose detail page links out instead of reproducing the text.
      if (
        (draft.body === null || draft.body === undefined || draft.body.trim() === '') &&
        (draft.sourceUrl === null || draft.sourceUrl === undefined || draft.sourceUrl.trim() === '')
      ) {
        throw new DomainError('An article with no stored text must carry a source URL to link out to.');
      }
      break;

    case ContentType.Research:
      if (
        (draft.body === null || draft.body === undefined || draft.body.trim() === '') &&
        (draft.documentUrl === null || draft.documentUrl === undefined || draft.documentUrl.trim() === '') &&
        (draft.sourceUrl === null || draft.sourceUrl === undefined || draft.sourceUrl.trim() === '')
      ) {
        throw new DomainError('A research record needs stored text, a document URL, or a source URL.');
      }
      break;
  }
}

function replaceWithMaximum(values: string[], maximum: number, countLabel: string): string[] {
  if (values.length > maximum) {
    throw new DomainError(`At most ${maximum} values are allowed here (got ${values.length}).`);
  }
  void countLabel;
  return values;
}

/**
 * Writes the type-specific block and clears every block that does not belong to
 * the new type, so a video converted to a book cannot keep an orphan series name.
 */
/** The type-specific block of the applied state — every key is required once
 *  populated, so spreading it into the aggregate keeps the result required. */
type ContentTypeFields = Pick<
  ContentItemState,
  | 'videoId'
  | 'videoProvider'
  | 'durationSeconds'
  | 'seriesName'
  | 'coverUrl'
  | 'publisher'
  | 'isbn'
  | 'publicationYear'
  | 'availability'
  | 'authorizedLinks'
  | 'readingTimeMinutes'
  | 'documentUrl'
  | 'documentFormat'
  | 'references'
>;

function assignTypeFields(draft: ContentItemDraft): ContentTypeFields {
  const next: ContentTypeFields = {
    videoId: null,
    videoProvider: null,
    durationSeconds: null,
    seriesName: null,
    coverUrl: null,
    publisher: null,
    isbn: null,
    publicationYear: null,
    availability: null,
    authorizedLinks: [],
    readingTimeMinutes: null,
    documentUrl: null,
    documentFormat: null,
    references: [],
  };

  switch (draft.type) {
    case ContentType.Video:
      next.videoId = guardOptional(draft.videoId, 64, 'Video id');
      next.videoProvider =
        draft.videoProvider !== null && draft.videoProvider !== undefined
          ? guardEnum(draft.videoProvider, VIDEO_PROVIDERS, 'VideoProvider')
          : null;
      next.durationSeconds = draft.durationSeconds ?? null;
      next.seriesName = guardOptional(draft.seriesName, SHORT_TEXT_MAX_LENGTH, 'Series name');
      break;

    case ContentType.Book: {
      next.coverUrl = guardUrl(draft.coverUrl, 'Cover url', URL_MAX_LENGTH);
      next.publisher = guardOptional(draft.publisher, SHORT_TEXT_MAX_LENGTH, 'Publisher');
      next.isbn = normalizeIsbn(draft.isbn);
      next.publicationYear = draft.publicationYear ?? null;
      next.availability =
        draft.availability !== null && draft.availability !== undefined
          ? guardEnum(draft.availability, BOOK_AVAILABILITIES, 'Availability')
          : null;

      const links = draft.authorizedLinks ?? [];
      if (links.length > MAX_AUTHORIZED_LINKS) {
        throw new DomainError(`A book may list at most ${MAX_AUTHORIZED_LINKS} authorised links.`);
      }
      next.authorizedLinks = links.map((link) => createAuthorizedLink(link.label, link.url));
      break;
    }

    case ContentType.Article:
      next.readingTimeMinutes = draft.readingTimeMinutes ?? null;
      break;

    case ContentType.Research: {
      next.documentUrl = guardUrl(draft.documentUrl, 'Document url', URL_MAX_LENGTH);
      next.documentFormat = guardOptional(draft.documentFormat, 20, 'Document format');
      next.references = replaceWithMaximum(guardDistinctValues(draft.references ?? [], 'Reference', 500), MAX_REFERENCES, 'references');
      break;
    }
  }

  return next;
}

/** Validates and maps the whole draft (ContentItem.Apply). */
export function applyDraft(draft: ContentItemDraft): Omit<ContentItemState, 'id' | 'createdAt' | 'updatedAt'> {
  // Every assignment runs after full validation, so a rejected draft leaves no partial state.
  validateDraft(draft);

  const tags = replaceWithMaximum(guardDistinctValues(draft.tags ?? [], 'Tag', TAGS_MAX_LENGTH), MAX_TAGS, 'tags');
  const typeFields = assignTypeFields(draft);

  const applied: Omit<ContentItemState, 'id' | 'createdAt' | 'updatedAt'> = {
    type: draft.type,
    // An omitted slug is derived from the title rather than rejected: the
    // frontend routes on slug and editors routinely leave the field blank.
    slug: resolveSlug(draft.slug, draft.title),
    title: guardRequired(draft.title, 'Title', TITLE_MAX_LENGTH),
    description: guardOptional(draft.description, DESCRIPTION_MAX_LENGTH, 'Description') ?? '',
    thumbnailUrl: guardUrl(draft.thumbnailUrl, 'Thumbnail url', URL_MAX_LENGTH),
    authorName: guardOptional(draft.authorName, SHORT_TEXT_MAX_LENGTH, 'Author name'),
    sourceUrl: guardUrl(draft.sourceUrl, 'Source url', URL_MAX_LENGTH),
    body: guardOptional(draft.body, BODY_MAX_LENGTH, 'Body'),
    featured: draft.featured,
    verified: draft.verified,
    demo: draft.demo,
    rightsStatus: guardEnum(draft.rightsStatus, RIGHTS_STATUSES, 'RightsStatus'),
    publishedAt: draft.publishedAt ?? null,
    tags,
    ...typeFields,
  };

  return applied;
}

/** Creates a new record from a draft and stamps its timestamps. */
export function createContentItem(id: string | null, draft: ContentItemDraft, now: Date): ContentItemState {
  const applied = applyDraft(draft);
  const resolvedId = guardOptional(id, ID_MAX_LENGTH, 'Content id') ?? newId(draft.title);
  return {
    ...applied,
    id: resolvedId,
    createdAt: now,
    updatedAt: now,
  };
}

/** Replaces the whole editable state of the record. */
export function updateContentItem(existing: ContentItemState, draft: ContentItemDraft, now: Date): ContentItemState {
  const applied = applyDraft(draft);
  return {
    ...applied,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

/** Throws a DomainError when the stored enum value is out of range (read-side guard). */
export function requireContentType(type: number): ContentType {
  if (!(CONTENT_TYPES as readonly number[]).includes(type)) {
    throw new DomainError(`Unsupported content type '${type}'.`);
  }
  return type as ContentType;
}

// ---------------------------------------------------------------------------
// JSON projection — the wire shape the frontend consumes. Enums travel as
// camelCase names; DateTimeOffset columns print "+00:00" with trimmed
// fractions (see lib/netjson).
// ---------------------------------------------------------------------------

export type ContentItemJson = Record<string, unknown>;

/**
 * ContentSummaryDto (the card-shaped listing projection): coverUrl sits before
 * authorName and the body/detail fields are deliberately absent — the reader
 * never SELECTs the Markdown for a listing page.
 */
export function contentSummaryToJson(item: {
  id: string;
  type: number;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  categoryIds: string[];
  tags: string[];
  featured: boolean;
  verified: boolean;
  demo: boolean;
  rightsStatus: number;
  publishedAt: Date | null;
  seriesName: string | null;
  durationSeconds: number | null;
  readingTimeMinutes: number | null;
}): ContentItemJson {
  return {
    id: item.id,
    type: contentTypeName(requireContentType(item.type)),
    slug: item.slug,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    coverUrl: item.coverUrl,
    authorName: item.authorName,
    sourceUrl: item.sourceUrl,
    categoryIds: item.categoryIds,
    tags: item.tags,
    featured: item.featured,
    verified: item.verified,
    demo: item.demo,
    rightsStatus: rightsStatusName(parseRightsStatus(item.rightsStatus) ?? RightsStatus.Unknown),
    publishedAt: item.publishedAt === null ? null : netTimestamp(item.publishedAt),
    seriesName: item.seriesName,
    durationSeconds: item.durationSeconds,
    readingTimeMinutes: item.readingTimeMinutes,
  };
}

/** PagedResult<T> wire shape: total is the real row count for pagination UIs. */
export function pagedResultJson(items: unknown[], page: number, pageSize: number, totalCount: number): Record<string, unknown> {
  const totalPages = pageSize === 0 ? 0 : Math.trunc((totalCount + pageSize - 1) / pageSize);
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export function authorizedLinkJson(link: AuthorizedLink): Record<string, string> {
  return { label: link.label, url: link.url };
}

export function contentItemToJson(item: {
  id: string;
  type: number;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  body?: string | null;
  categoryIds: string[];
  tags: string[];
  featured: boolean;
  verified: boolean;
  demo: boolean;
  rightsStatus: number;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  videoId: string | null;
  videoProvider: number | null;
  durationSeconds: number | null;
  seriesName: string | null;
  coverUrl: string | null;
  publisher: string | null;
  isbn: string | null;
  publicationYear: number | null;
  availability: number | null;
  authorizedLinks: { label: string; url: string }[];
  readingTimeMinutes: number | null;
  references: string[];
  documentUrl: string | null;
  documentFormat: string | null;
}): ContentItemJson {
  const json: ContentItemJson = {
    id: item.id,
    type: contentTypeName(requireContentType(item.type)),
    slug: item.slug,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    authorName: item.authorName,
    sourceUrl: item.sourceUrl,
  };
  if (item.body !== undefined) json.body = item.body;
  json.categoryIds = item.categoryIds;
  json.tags = item.tags;
  json.featured = item.featured;
  json.verified = item.verified;
  json.demo = item.demo;
  json.rightsStatus = rightsStatusName(parseRightsStatus(item.rightsStatus) ?? RightsStatus.Unknown);
  // DateTimeOffset columns serialise as UTC "+00:00" with trimmed fractions —
  // never JSON.stringify's own Date format.
  json.publishedAt = item.publishedAt === null ? null : netTimestamp(item.publishedAt);
  if (item.createdAt !== undefined) json.createdAt = netTimestamp(item.createdAt);
  if (item.updatedAt !== undefined) json.updatedAt = netTimestamp(item.updatedAt);
  json.videoId = item.videoId;
  json.videoProvider = item.videoProvider === null ? null : videoProviderName(parseVideoProvider(item.videoProvider) ?? 1);
  json.durationSeconds = item.durationSeconds;
  json.seriesName = item.seriesName;
  json.coverUrl = item.coverUrl;
  json.publisher = item.publisher;
  json.isbn = item.isbn;
  json.publicationYear = item.publicationYear;
  json.availability = item.availability === null ? null : bookAvailabilityName(item.availability as BookAvailability);
  json.authorizedLinks = item.authorizedLinks.map(authorizedLinkJson);
  json.readingTimeMinutes = item.readingTimeMinutes;
  json.references = item.references;
  json.documentUrl = item.documentUrl;
  json.documentFormat = item.documentFormat;
  return json;
}
