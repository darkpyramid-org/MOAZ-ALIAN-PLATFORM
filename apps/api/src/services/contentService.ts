import { db } from '../lib/db.js';
import { env } from '../config/env.js';
import { ReadThroughCache } from '../lib/cache.js';
import { bumpVersion, currentVersion } from './cacheVersion.js';
import * as reader from './contentReader.js';
import type { NormalizedQuery } from './contentReader.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js';
import { contentTypeName, RightsStatus, type VideoProvider, type BookAvailability, type ContentType } from '../domain/enums.js';
import { createContentItem, requireContentType, resolveSlug, updateContentItem, type ContentItemDraft, type ContentItemState } from '../domain/contentItem.js';
import { validateUpsertContent, type UpsertContentShape } from '../domain/validators.js';
import { utcNow } from '../lib/clock.js';
import { buildQueryKey } from '../domain/query.js';
import { normalizeSlug } from '../lib/slugs.js';
import type { Caller } from './caller.js';

/**
 * Content use cases — the port of Application.Services.ContentService. This is
 * the only place a request turns into domain behaviour: rights, uniqueness
 * probes, category resolution, cache policy and the commit live here so the
 * HTTP layer stays a thin adapter.
 *
 * Failure ORDER is part of the contract (the battery pins it):
 *   403 (role) → 400 (shape) → 404 (missing record, update only) →
 *   422 (slug/aggregate invariants) → 409 (slug conflict) → 404 (category).
 */
const cache = new ReadThroughCache(20_000, env.CONTENT_CACHE_ENABLED);

const QUERY_TTL_MS = env.CONTENT_CACHE_QUERY_TTL_MS;
const ITEM_TTL_MS = env.CONTENT_CACHE_ITEM_TTL_MS;
const COUNTS_TTL_MS = env.CONTENT_CACHE_COUNTS_TTL_MS;

export async function listPage(query: NormalizedQuery): Promise<Record<string, unknown>> {
  const key = buildQueryKey(query, currentVersion());
  const cached = cache.tryGet<Record<string, unknown>>(key);
  if (cached !== undefined) return cached;

  const page = await reader.queryPage(query);
  cache.set(key, page, QUERY_TTL_MS);
  return page;
}

export async function getBySlug(type: number, slug: string | null): Promise<Record<string, unknown>> {
  // Route slugs arrive verbatim; normalising means "/books/عقيدة" matches the
  // stored form. An unusable slug reports the RAW value (not the normalised
  // one) in the 404 detail — observed contract.
  const normalizedSlug = normalizeSlug(slug ?? '');
  if (normalizedSlug === '') {
    throw new NotFoundError('Content', slug ?? '');
  }

  requireContentType(type);

  const key = `content:slug:v${currentVersion()}|${type}|${normalizedSlug}`;
  const cached = cache.tryGet<Record<string, unknown>>(key);
  if (cached !== undefined) return cached;

  const found = await reader.findDetailBySlug(type, normalizedSlug);
  if (found === null) {
    throw new NotFoundError('Content', normalizedSlug);
  }
  cache.set(key, found, ITEM_TTL_MS);
  return found;
}

export async function counts(): Promise<Record<string, unknown>[]> {
  const key = `content:counts:v${currentVersion()}`;
  const cached = cache.tryGet<Record<string, unknown>[]>(key);
  if (cached !== undefined) return cached;

  const rows = await reader.countByType();
  // Snapshotted as a plain array: the cached value is shared state.
  const snapshot = rows.map((row) => ({
    type: contentTypeName(requireContentType(row.type)),
    count: row.count,
  }));
  cache.set(key, snapshot, COUNTS_TTL_MS);
  return snapshot;
}

export async function snapshotAll(): Promise<Record<string, unknown>[]> {
  const key = `content:snapshot:v${currentVersion()}`;
  const cached = cache.tryGet<Record<string, unknown>[]>(key);
  if (cached !== undefined) return cached;

  const rows = await reader.snapshot();
  cache.set(key, rows, QUERY_TTL_MS);
  return rows;
}

function requireEditor(caller: Caller | undefined): void {
  // Defense in depth: the route policy already enforced this; the use case
  // re-checks so a wiring mistake can never open a write.
  if (caller === undefined || !caller.canEditContent) {
    throw new ForbiddenError('Editing the library requires an admin or editor role.');
  }
}

/**
 * HTTP write model → domain draft, port of ContentItemMapper.ToDraft. The
 * binder leaves absent members undefined; the record's CLR defaults fill them
 * here: booleans default false, RightsStatus defaults Unknown.
 */
function toDraft(bound: Record<string, unknown>): ContentItemDraft {
  return {
    type: bound['type'] as ContentType,
    slug: (bound['slug'] as string | null | undefined) ?? null,
    title: (bound['title'] as string | null | undefined) ?? null,
    description: (bound['description'] as string | null | undefined) ?? null,
    thumbnailUrl: (bound['thumbnailUrl'] as string | null | undefined) ?? null,
    authorName: (bound['authorName'] as string | null | undefined) ?? null,
    sourceUrl: (bound['sourceUrl'] as string | null | undefined) ?? null,
    body: (bound['body'] as string | null | undefined) ?? null,
    tags: (bound['tags'] as (string | null)[] | null | undefined) ?? null,
    featured: bound['featured'] === true,
    verified: bound['verified'] === true,
    demo: bound['demo'] === true,
    rightsStatus: ((bound['rightsStatus'] as RightsStatus | null | undefined) ?? RightsStatus.Unknown) as RightsStatus,
    publishedAt: (bound['publishedAt'] as Date | null | undefined) ?? null,
    videoId: (bound['videoId'] as string | null | undefined) ?? null,
    videoProvider: (bound['videoProvider'] as VideoProvider | null | undefined) ?? null,
    durationSeconds: (bound['durationSeconds'] as number | null | undefined) ?? null,
    seriesName: (bound['seriesName'] as string | null | undefined) ?? null,
    coverUrl: (bound['coverUrl'] as string | null | undefined) ?? null,
    publisher: (bound['publisher'] as string | null | undefined) ?? null,
    isbn: (bound['isbn'] as string | null | undefined) ?? null,
    publicationYear: (bound['publicationYear'] as number | null | undefined) ?? null,
    availability: (bound['availability'] as BookAvailability | null | undefined) ?? null,
    authorizedLinks: (bound['authorizedLinks'] as { label: string | null; url: string | null }[] | null | undefined) ?? null,
    readingTimeMinutes: (bound['readingTimeMinutes'] as number | null | undefined) ?? null,
    references: (bound['references'] as (string | null)[] | null | undefined) ?? null,
    documentUrl: (bound['documentUrl'] as string | null | undefined) ?? null,
    documentFormat: (bound['documentFormat'] as string | null | undefined) ?? null,
  };
}

export async function createContent(
  bound: Record<string, unknown>,
  caller: Caller | undefined,
): Promise<Record<string, unknown>> {
  requireEditor(caller);

  // FluentValidation runs before any domain work — a malformed Title must not
  // even probe the slug index.
  validateUpsertContent(bound as unknown as UpsertContentShape);
  const draft = toDraft(bound);
  const slug = resolveSlug(draft.slug, draft.title);

  if (await reader.slugExists(draft.type, slug, null)) {
    throw new ConflictError(
      `A ${clrTypeName(draft.type)} record with slug '${slug}' already exists.`,
    );
  }

  // The id is server-generated: clients address records by slug, and accepting
  // a caller's id would make every write a potential impersonation.
  const item = createContentItem(null, draft, utcNow());
  const categoryIds = await resolveCategoryIds(bound['categoryIds']);

  await persist(item, categoryIds);
  bumpVersion();
  return readBack(item.id);
}

export async function updateContent(
  id: string,
  bound: Record<string, unknown>,
  caller: Caller | undefined,
): Promise<Record<string, unknown>> {
  requireEditor(caller);

  // Validation precedes the 404 probe: an editor sending a bad payload learns
  // about the payload, not about the (possibly unrelated) missing record.
  validateUpsertContent(bound as unknown as UpsertContentShape);

  const existing = await findState(id);
  if (existing === null) {
    throw new NotFoundError('Content', id);
  }

  const draft = toDraft(bound);
  const slug = resolveSlug(draft.slug, draft.title);

  if (await reader.slugExists(draft.type, slug, existing.id)) {
    throw new ConflictError(
      `A ${clrTypeName(draft.type)} record with slug '${slug}' already exists.`,
    );
  }

  // Update validates the whole draft before assigning anything, so a rejected
  // change leaves the stored record untouched.
  const next = updateContentItem(existing, draft, utcNow());
  const categoryIds = await resolveCategoryIds(bound['categoryIds']);

  await persist(next, categoryIds);
  bumpVersion();
  return readBack(next.id);
}

export async function deleteContent(id: string, caller: Caller | undefined): Promise<void> {
  requireEditor(caller);
  const existing = await db.contentItem.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) {
    throw new NotFoundError('Content', id);
  }

  await db.contentItem.delete({ where: { id: existing.id } }); // link rows cascade
  bumpVersion();
}

/** Loads the stored aggregate for update — the tracked entity of the original. */
async function findState(id: string): Promise<ContentItemState | null> {
  const row = await db.contentItem.findUnique({ where: { id } });
  if (row === null) return null;

  return {
    id: row.id,
    type: requireContentType(row.type),
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    authorName: row.authorName,
    sourceUrl: row.sourceUrl,
    body: row.body,
    featured: row.featured,
    verified: row.verified,
    demo: row.demo,
    rightsStatus: row.rightsStatus as RightsStatus,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    videoId: row.videoId,
    videoProvider: (row.videoProvider ?? null) as VideoProvider | null,
    durationSeconds: row.durationSeconds,
    seriesName: row.seriesName,
    coverUrl: row.coverUrl,
    publisher: row.publisher,
    isbn: row.isbn,
    publicationYear: row.publicationYear,
    availability: (row.availability ?? null) as BookAvailability | null,
    authorizedLinks: parseAuthorizedLinks(row.authorizedLinks),
    readingTimeMinutes: row.readingTimeMinutes,
    references: parseJsonText(row.references),
    documentUrl: row.documentUrl,
    documentFormat: row.documentFormat,
    tags: parseJsonText(row.tags),
  };
}

function parseAuthorizedLinks(value: unknown): { label: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  const links: { label: string; url: string }[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as { [key: string]: unknown };
    const label = record['Label'] ?? record['label'];
    const url = record['Url'] ?? record['url'];
    if (typeof label === 'string' && typeof url === 'string') links.push({ label, url });
  }
  return links;
}

function parseJsonText(text: string): string[] {
  if (text === '') return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/**
 * Resolves the requested category ids against the database. Missing ids fail
 * the whole write: silent dropping would leave an editor believing the content
 * was filed somewhere it never was. Duplicates collapse Ordinal-first, exactly
 * like the original's Distinct(StringComparer.Ordinal); the 404 names the
 * missing ids in request order, comma-joined.
 */
async function resolveCategoryIds(raw: unknown): Promise<string[]> {
  const requested = Array.isArray(raw) ? raw : [];
  const ids = [...new Set(requested.map((id) => String(id).trim()))];

  const found = await db.category.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) {
    const foundIds = new Set(found.map((category) => category.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    throw new NotFoundError('Category', missing.join(', '));
  }
  return ids;
}

/**
 * Writes the aggregate + its category links in one transaction. Tags and
 * References keep the JSON-compact TEXT contract the EF converter chose, and
 * AuthorisedLinks land as jsonb with PascalCase keys — byte-compatible with
 * what the .NET runtime writes, so one database serves both during rollout.
 */
async function persist(item: ContentItemState, categoryIds: string[]): Promise<void> {
  const data = {
    type: item.type,
    slug: item.slug,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    authorName: item.authorName,
    sourceUrl: item.sourceUrl,
    body: item.body,
    featured: item.featured,
    verified: item.verified,
    demo: item.demo,
    rightsStatus: item.rightsStatus,
    publishedAt: item.publishedAt,
    videoId: item.videoId,
    videoProvider: item.videoProvider,
    durationSeconds: item.durationSeconds,
    seriesName: item.seriesName,
    coverUrl: item.coverUrl,
    publisher: item.publisher,
    isbn: item.isbn,
    publicationYear: item.publicationYear,
    availability: item.availability,
    authorizedLinks: item.authorizedLinks.map((link) => ({ Label: link.label, Url: link.url })),
    readingTimeMinutes: item.readingTimeMinutes,
    references: JSON.stringify(item.references),
    documentUrl: item.documentUrl,
    documentFormat: item.documentFormat,
    tags: JSON.stringify(item.tags),
    updatedAt: item.updatedAt,
  };

  await db.$transaction([
    db.contentItem.upsert({
      where: { id: item.id },
      create: { id: item.id, createdAt: item.createdAt, ...data },
      update: data,
    }),
    db.contentItemCategory.deleteMany({ where: { contentItemsId: item.id } }),
    ...categoryIds.map((categoryId) =>
      db.contentItemCategory.create({ data: { contentItemsId: item.id, categoriesId: categoryId } }),
    ),
  ]);
}

async function readBack(id: string): Promise<Record<string, unknown>> {
  const dto = await reader.findDetailById(id);
  // The row was committed moments ago; this is only reachable if it vanished
  // mid-request (or a read replica lagged — not our deployment shape).
  if (dto === null) throw new NotFoundError('Content', id);
  return dto;
}

/** CLR enum member name — the conflict message interpolates the enum itself. */
function clrTypeName(type: ContentType): string {
  return ['Video', 'Book', 'Article', 'Research'][type - 1] ?? String(type);
}
