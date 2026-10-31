export type ContentType = "video" | "book" | "article" | "research";

export type RightsStatus = "owned" | "licensed" | "external" | "unknown";

export interface Category {
  id: string;
  name: string;
  description: string;
  /** Full stored Markdown detail text; absent when no authorized text was supplied. */
  body?: string | null;
}

interface BaseItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  categoryIds: string[];
  tags: string[];
  publishedAt: string | null;
  sourceUrl: string | null;
  featured: boolean;
  /** true = metadata traced to a verified public source; false = demonstration content */
  verified: boolean;
  /** true = clearly-labeled demonstration record, not real published material */
  demo: boolean;
  rightsStatus: RightsStatus;
  /** Full stored Markdown details (episode notes, book overview, research text); absent until real text is supplied. */
  body?: string | null;
}

export interface VideoItem extends BaseItem {
  type: "video";
  videoId: string | null;
  videoProvider: "youtube" | null;
  durationSeconds: number | null;
  seriesName: string | null;
}

export interface BookItem extends BaseItem {
  type: "book";
  coverUrl: string | null;
  publisher: string | null;
  isbn: string | null;
  publicationYear: number | null;
  availability: "digital" | "print" | "unknown";
  authorizedLinks: { label: string; url: string }[];
}

export interface ArticleItem extends BaseItem {
  type: "article";
  /** null body = external article; the detail page links out instead of reproducing text */
  body: string | null;
  readingTimeMinutes: number | null;
}

export interface ResearchItem extends BaseItem {
  type: "research";
  references: string[];
  documentUrl: string | null;
  documentFormat: string | null;
}

export type ContentItem = VideoItem | BookItem | ArticleItem | ResearchItem;

export const TYPE_LABELS: Record<ContentType, string> = {
  video: "فيديو",
  book: "كتاب",
  article: "مقال",
  research: "بحث",
};

export const TYPE_ROUTES: Record<ContentType, string> = {
  video: "/videos",
  book: "/books",
  article: "/articles",
  research: "/research",
};
