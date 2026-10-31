import { searchItems } from "@/lib/content";
import type { ContentItem } from "@/types/content";

export type SortKey = "new" | "old" | "title";

export interface ListingSearch {
  q?: string | undefined;
  cat?: string | undefined;
  series?: string | undefined;
  sort?: SortKey | undefined;
  page?: number | undefined;
}

const SORTS: SortKey[] = ["new", "old", "title"];

/** URL search-param validator shared by every listing route. */
export function parseListingSearch(raw: Record<string, unknown>): ListingSearch {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const sort = str(raw["sort"]);
  const page = Number(raw["page"]);
  return {
    q: str(raw["q"]),
    cat: str(raw["cat"]),
    series: str(raw["series"]),
    sort: sort && (SORTS as string[]).includes(sort) ? (sort as SortKey) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

function seriesOf(it: ContentItem): string | null {
  return it.type === "video" ? it.seriesName : null;
}

export function seriesNames(items: ContentItem[]): string[] {
  return [...new Set(items.map(seriesOf).filter((s): s is string => !!s))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}

/** Pure filter + sort used by listing pages (search relevance wins over sort when a query is set). */
export function applyListing(items: ContentItem[], s: ListingSearch): ContentItem[] {
  let pool = s.cat ? items.filter((it) => it.categoryIds.includes(s.cat!)) : items;
  if (s.series) pool = pool.filter((it) => seriesOf(it) === s.series);
  if (s.q?.trim()) return searchItems(s.q, pool).map((h) => h.item);
  const sort = s.sort ?? "new";
  return [...pool].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ar");
    const c = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    return sort === "new" ? c : -c;
  });
}
