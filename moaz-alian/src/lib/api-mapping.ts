import type {
  ArticleItem,
  BookItem,
  Category,
  ContentItem,
  ContentType,
  ResearchItem,
  RightsStatus,
  VideoItem,
} from "@/types/content";

/**
 * Pure translation between the API's wire contracts and the UI's types.
 *
 * Split out of `api.ts` because it is the only place the two shape families meet:
 * keeping it dependency-free means a test (and the identity verifier in
 * `api-server/tools/`) can import it without a browser, a session or a fetch.
 */

interface AuthorizedLinkDto {
  label: string;
  url: string;
}

export interface ContentItemDto {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  body: string | null;
  categoryIds: string[];
  tags: string[];
  featured: boolean;
  verified: boolean;
  demo: boolean;
  rightsStatus: RightsStatus;
  publishedAt: string | null;
  videoId: string | null;
  videoProvider: "youtube" | null;
  durationSeconds: number | null;
  seriesName: string | null;
  coverUrl: string | null;
  publisher: string | null;
  isbn: string | null;
  publicationYear: number | null;
  availability: BookItem["availability"] | null;
  authorizedLinks: AuthorizedLinkDto[];
  readingTimeMinutes: number | null;
  references: string[];
  documentUrl: string | null;
  documentFormat: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  contentCount: number;
}

/**
 * The API stores a full timestamp; the UI works with a calendar date because
 * `formatDateAr` appends its own time. Truncating here keeps every consumer and
 * the formatter unchanged.
 */
export const asDate = (value: string | null): string | null => (value ? value.slice(0, 10) : null);

/**
 * The reverse trip for writes: a bare date is stored at midnight UTC so the
 * listing order matches what the editor showed, and anything already carrying a
 * time is left alone.
 */
export const asTimestamp = (value: string | null): string | null => {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
};

export function toContentItem(dto: ContentItemDto): ContentItem {
  const base = {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    description: dto.description,
    thumbnailUrl: dto.thumbnailUrl,
    authorName: dto.authorName,
    categoryIds: dto.categoryIds,
    tags: dto.tags,
    publishedAt: asDate(dto.publishedAt),
    sourceUrl: dto.sourceUrl,
    featured: dto.featured,
    verified: dto.verified,
    demo: dto.demo,
    rightsStatus: dto.rightsStatus,
    body: dto.body,
  };

  switch (dto.type) {
    case "video":
      return {
        ...base,
        type: "video",
        videoId: dto.videoId,
        videoProvider: dto.videoProvider,
        durationSeconds: dto.durationSeconds,
        seriesName: dto.seriesName,
      } satisfies VideoItem;
    case "book":
      return {
        ...base,
        type: "book",
        coverUrl: dto.coverUrl,
        publisher: dto.publisher,
        isbn: dto.isbn,
        publicationYear: dto.publicationYear,
        // A book always has an availability in the UI; an unset column reads as "unknown".
        availability: dto.availability ?? "unknown",
        authorizedLinks: dto.authorizedLinks.map((l) => ({ label: l.label, url: l.url })),
      } satisfies BookItem;
    case "article":
      return {
        ...base,
        type: "article",
        readingTimeMinutes: dto.readingTimeMinutes,
      } satisfies ArticleItem;
    default:
      return {
        ...base,
        type: "research",
        references: dto.references,
        documentUrl: dto.documentUrl,
        documentFormat: dto.documentFormat,
      } satisfies ResearchItem;
  }
}

/** Categories in display order; `sort_order` keeps the dashboard's existing field name. */
export function toCategory(dto: CategoryDto): Category & { sort_order: number } {
  return { id: dto.id, name: dto.name, description: dto.description, sort_order: dto.sortOrder };
}

/**
 * UI record → the API's write model. Id, timestamps and the derived slug are the
 * server's, which is why none of them are sent here.
 */
export function toUpsertRequest(item: ContentItem, slug: string): Record<string, unknown> {
  const common = {
    type: item.type,
    slug: slug || undefined,
    title: item.title,
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    authorName: item.authorName,
    sourceUrl: item.sourceUrl,
    body: item.body ?? null,
    categoryIds: item.categoryIds,
    tags: item.tags,
    featured: item.featured,
    verified: item.verified,
    demo: item.demo,
    rightsStatus: item.rightsStatus,
    publishedAt: asTimestamp(item.publishedAt),
  };

  switch (item.type) {
    case "video":
      return {
        ...common,
        videoId: item.videoId,
        videoProvider: item.videoProvider,
        durationSeconds: item.durationSeconds,
        seriesName: item.seriesName,
      };
    case "book":
      return {
        ...common,
        coverUrl: item.coverUrl,
        publisher: item.publisher,
        isbn: item.isbn,
        publicationYear: item.publicationYear,
        availability: item.availability,
        authorizedLinks: item.authorizedLinks,
      };
    case "article":
      return { ...common, readingTimeMinutes: item.readingTimeMinutes };
    default:
      return {
        ...common,
        references: item.references,
        documentUrl: item.documentUrl,
        documentFormat: item.documentFormat,
      };
  }
}
