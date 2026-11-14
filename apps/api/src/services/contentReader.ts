import { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import {
  contentItemToJson,
  contentSummaryToJson,
  pagedResultJson,
} from '../domain/contentItem.js';

/**
 * SQL-side reads for the public library — the port of
 * Infrastructure.Persistence.Queries.ContentReader.
 *
 * The read models are projected straight from SQL: no aggregate is loaded, no
 * change-tracker bookkeeping, and listing queries never SELECT the Markdown
 * body (the cards never render it — shipping it would multiply payload size).
 *
 * The statements mirror what EF Core generates for the original LINQ, so the
 * two runtimes answer with the same rows in the same order on the same
 * database:
 *   - undated records pin to the far end via COALESCE(PublishedAt, '0001-01-01')
 *     — Postgres' "NULLs first DESC" default would otherwise put them on top;
 *   - every ordering ends on Id so pagination is deterministic when values tie;
 *   - search uses ILIKE with the three wildcards escaped; the relevance ranking
 *     deliberately does NOT escape its prefix probe (the original's StartsWith
 *     translation behaves that way and the battery pins it);
 *   - category links are resolved in a second query against the EF-named join
 *     table (CategoriesId / ContentItemsId).
 */

const SELECT_SUMMARY = `
    c."Id", c."Type", c."Slug", c."Title", c."Description", c."ThumbnailUrl",
    c."CoverUrl", c."AuthorName", c."SourceUrl", c."Featured", c."Verified",
    c."Demo", c."RightsStatus", c."PublishedAt", c."SeriesName",
    c."DurationSeconds", c."ReadingTimeMinutes", c."Tags"`;

const SELECT_DETAIL = `
    ${SELECT_SUMMARY},
    c."Body", c."CreatedAt", c."UpdatedAt", c."VideoId", c."VideoProvider",
    c."Publisher", c."Isbn", c."PublicationYear", c."Availability",
    c."AuthorizedLinks", c."References", c."DocumentUrl", c."DocumentFormat"`;

/** Row shape out of Postgres (smallint/int → number, timestamptz → Date, text JSON compact). */
interface SummaryRow {
  Id: string;
  Type: number;
  Slug: string;
  Title: string;
  Description: string;
  ThumbnailUrl: string | null;
  CoverUrl: string | null;
  AuthorName: string | null;
  SourceUrl: string | null;
  Featured: boolean;
  Verified: boolean;
  Demo: boolean;
  RightsStatus: number;
  PublishedAt: Date | null;
  SeriesName: string | null;
  DurationSeconds: number | null;
  ReadingTimeMinutes: number | null;
  Tags: string;
}

interface DetailRow extends SummaryRow {
  Body: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  VideoId: string | null;
  VideoProvider: number | null;
  Publisher: string | null;
  Isbn: string | null;
  PublicationYear: number | null;
  Availability: number | null;
  AuthorizedLinks: Prisma.JsonValue | null;
  References: string;
  DocumentUrl: string | null;
  DocumentFormat: string | null;
}

/** Single quotes doubled — these literals come from the query string, never from trusted input. */
function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function quote(value: string): string {
  return `'${escapeLiteral(value)}'`;
}

/** LIKE/ILIKE wildcards escaped with Postgres' default backslash escape char. */
export function escapeLikePattern(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

interface FilterInput {
  type: number | null;
  categoryId: string | null;
  search: string | null;
  series: string | null;
  featured: boolean | null;
  demo: boolean | null;
}

function buildWhere(input: FilterInput): string {
  const clauses: string[] = [];

  if (input.type !== null) clauses.push(`c."Type" = ${input.type}`);
  if (input.categoryId !== null) {
    // Correlated EXISTS, as EF generates for item.Categories.Any(...).
    clauses.push(
      `EXISTS (SELECT 1 FROM "library"."content_item_categories" cic ` +
        `WHERE cic."ContentItemsId" = c."Id" AND cic."CategoriesId" = ${quote(input.categoryId)})`,
    );
  }
  if (input.series !== null) {
    clauses.push(`c."SeriesName" ILIKE ${quote(escapeLikePattern(input.series))}`);
  }
  if (input.featured !== null) clauses.push(`c."Featured" = ${input.featured}`);
  if (input.demo !== null) clauses.push(`c."Demo" = ${input.demo}`);
  if (input.search !== null) {
    const pattern = quote(`%${escapeLikePattern(input.search)}%`);
    clauses.push(
      `(c."Title" ILIKE ${pattern} OR c."Description" ILIKE ${pattern} OR ` +
        `c."AuthorName" ILIKE ${pattern} OR c."SeriesName" ILIKE ${pattern})`,
    );
  }

  return clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`;
}

function orderBy(sort: number, search: string | null): string {
  // The coalesce literal is EF's translation of `PublishedAt ?? DateTimeOffset.MinValue`.
  const coalesce = `COALESCE(c."PublishedAt", TIMESTAMPTZ '0001-01-01 00:00:00+00')`;
  switch (sort) {
    case 1: // oldest
      return `ORDER BY ${coalesce}, c."Id" DESC`;
    case 2: // title
      return `ORDER BY c."Title", c."Id" DESC`;
    case 3: // relevance (falls back to newest without a search term)
      if (search !== null && search !== '') {
        const prefix = quote(`${search}%`); // deliberately UNescaped — StartsWith translation
        return (
          `ORDER BY CASE WHEN c."Title" = ${quote(search)} THEN 0 ` +
          `WHEN c."Title" LIKE ${prefix} THEN 1 ELSE 2 END, ${coalesce} DESC, c."Id" DESC`
        );
      }
      return `ORDER BY ${coalesce} DESC, c."Id" DESC`;
    default: // newest
      return `ORDER BY ${coalesce} DESC, c."Id" DESC`;
  }
}

/** Compact-JSON TEXT column (Tags / References) → string[], tolerating junk. */
function parseJsonText(text: string): string[] {
  if (text === '' || text === null || text === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/** jsonb [{Label, Url}] (EF's PascalCase storage) → wire pairs. */
function parseAuthorizedLinks(value: Prisma.JsonValue | null): { label: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  const links: { label: string; url: string }[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as { [key: string]: unknown };
    const label = record['Label'];
    const url = record['Url'];
    if (typeof label === 'string' && typeof url === 'string') {
      links.push({ label, url });
    }
  }
  return links;
}

/** CategoryIds for a batch of content ids, resolved against the EF-named join table. */
async function loadCategoryIds(ids: readonly string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;

  const rows = await db.$queryRaw<{ ContentItemsId: string; CategoriesId: string }[]>(
    Prisma.raw(
      `SELECT "ContentItemsId", "CategoriesId" FROM "library"."content_item_categories" ` +
        `WHERE "ContentItemsId" IN (${ids.map((id) => quote(id)).join(', ')}) ` +
        `ORDER BY "CategoriesId"`,
    ),
  );
  for (const row of rows) {
    const list = map.get(row.ContentItemsId) ?? [];
    list.push(row.CategoriesId);
    map.set(row.ContentItemsId, list);
  }
  return map;
}

export interface NormalizedQuery {
  type: number | null;
  categoryId: string | null;
  search: string | null;
  series: string | null;
  featured: boolean | null;
  demo: boolean | null;
  sort: number;
  page: number;
  pageSize: number;
}

export async function queryPage(query: NormalizedQuery): Promise<Record<string, unknown>> {
  const where = buildWhere({
    type: query.type,
    categoryId: query.categoryId,
    search: query.search,
    series: query.series,
    featured: query.featured,
    demo: query.demo,
  });

  const totalRows = await db.$queryRaw<{ count: number }[]>(
    Prisma.raw(`SELECT COUNT(*)::int AS count FROM "library"."content_items" c${where}`),
  );
  const total = totalRows[0]?.count ?? 0;

  if (total === 0) {
    // One COUNT replaces COUNT + wasted SELECT + materialisation for pages past the end.
    return pagedResultJson([], query.page, query.pageSize, 0);
  }

  const rows = await db.$queryRaw<SummaryRow[]>(
    Prisma.raw(
      `SELECT ${SELECT_SUMMARY} FROM "library"."content_items" c${where} ${orderBy(query.sort, query.search)} ` +
        `OFFSET ${(query.page - 1) * query.pageSize} LIMIT ${query.pageSize}`,
    ),
  );

  const categoryMap = await loadCategoryIds(rows.map((row) => row.Id));
  const items = rows.map((row) =>
    contentSummaryToJson({
      id: row.Id,
      type: row.Type,
      slug: row.Slug,
      title: row.Title,
      description: row.Description,
      thumbnailUrl: row.ThumbnailUrl,
      coverUrl: row.CoverUrl,
      authorName: row.AuthorName,
      sourceUrl: row.SourceUrl,
      categoryIds: categoryMap.get(row.Id) ?? [],
      tags: parseJsonText(row.Tags),
      featured: row.Featured,
      verified: row.Verified,
      demo: row.Demo,
      rightsStatus: row.RightsStatus,
      publishedAt: row.PublishedAt,
      seriesName: row.SeriesName,
      durationSeconds: row.DurationSeconds,
      readingTimeMinutes: row.ReadingTimeMinutes,
    }),
  );

  return pagedResultJson(items, query.page, query.pageSize, total);
}

function detailToJson(row: DetailRow, categoryIds: string[]): Record<string, unknown> {
  return contentItemToJson({
    id: row.Id,
    type: row.Type,
    slug: row.Slug,
    title: row.Title,
    description: row.Description,
    thumbnailUrl: row.ThumbnailUrl,
    authorName: row.AuthorName,
    sourceUrl: row.SourceUrl,
    body: row.Body,
    categoryIds,
    tags: parseJsonText(row.Tags),
    featured: row.Featured,
    verified: row.Verified,
    demo: row.Demo,
    rightsStatus: row.RightsStatus,
    publishedAt: row.PublishedAt,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    videoId: row.VideoId,
    videoProvider: row.VideoProvider,
    durationSeconds: row.DurationSeconds,
    seriesName: row.SeriesName,
    coverUrl: row.CoverUrl,
    publisher: row.Publisher,
    isbn: row.Isbn,
    publicationYear: row.PublicationYear,
    availability: row.Availability,
    authorizedLinks: parseAuthorizedLinks(row.AuthorizedLinks),
    readingTimeMinutes: row.ReadingTimeMinutes,
    references: parseJsonText(row.References),
    documentUrl: row.DocumentUrl,
    documentFormat: row.DocumentFormat,
  });
}

export async function findDetailBySlug(type: number, slug: string): Promise<Record<string, unknown> | null> {
  const rows = await db.$queryRaw<DetailRow[]>(
    Prisma.raw(
      `SELECT ${SELECT_DETAIL} FROM "library"."content_items" c ` +
        `WHERE c."Type" = ${type} AND c."Slug" = ${quote(slug)} LIMIT 1`,
    ),
  );
  const row = rows[0];
  if (row === undefined) return null;
  const categoryMap = await loadCategoryIds([row.Id]);
  return detailToJson(row, categoryMap.get(row.Id) ?? []);
}

export async function findDetailById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await db.$queryRaw<DetailRow[]>(
    Prisma.raw(
      `SELECT ${SELECT_DETAIL} FROM "library"."content_items" c WHERE c."Id" = ${quote(id)} LIMIT 1`,
    ),
  );
  const row = rows[0];
  if (row === undefined) return null;
  const categoryMap = await loadCategoryIds([row.Id]);
  return detailToJson(row, categoryMap.get(row.Id) ?? []);
}

export async function countByType(): Promise<{ type: number; count: number }[]> {
  // Group order is unspecified in SQL; the diff normaliser sorts these arrays,
  // and ORDER BY Type keeps repeat responses stable anyway.
  const rows = await db.$queryRaw<{ Type: number; count: number }[]>(
    Prisma.raw(
      `SELECT c."Type" AS "Type", COUNT(*)::int AS count FROM "library"."content_items" c GROUP BY c."Type" ORDER BY c."Type"`,
    ),
  );
  return rows.map((row) => ({ type: row.Type, count: row.count }));
}

export async function snapshot(): Promise<Record<string, unknown>[]> {
  const rows = await db.$queryRaw<DetailRow[]>(
    Prisma.raw(
      `SELECT ${SELECT_DETAIL} FROM "library"."content_items" c ` +
        `ORDER BY COALESCE(c."PublishedAt", TIMESTAMPTZ '0001-01-01 00:00:00+00') DESC, c."Id" DESC`,
    ),
  );
  const categoryMap = await loadCategoryIds(rows.map((row) => row.Id));
  return rows.map((row) => detailToJson(row, categoryMap.get(row.Id) ?? []));
}

/** Slug/type uniqueness probe for create/update (ignoreId excludes the record being replaced). */
export async function slugExists(type: number, slug: string, ignoreId: string | null): Promise<boolean> {
  const rows = await db.$queryRaw<{ exists: boolean }[]>(
    Prisma.raw(
      `SELECT EXISTS(SELECT 1 FROM "library"."content_items" c WHERE c."Type" = ${type} AND c."Slug" = ${quote(slug)}` +
        (ignoreId === null ? '' : ` AND c."Id" <> ${quote(ignoreId)}`) +
        `) AS "exists"`,
    ),
  );
  return rows[0]?.exists ?? false;
}
