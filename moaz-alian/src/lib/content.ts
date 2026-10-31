import { categories, categoryById } from "@/data/categories";
import { seedItems } from "@/data/seed";
import type { Category, ContentItem, ContentType } from "@/types/content";

/**
 * Live library store. Starts with the bundled seed so pages never render empty,
 * then is replaced in place with database rows via hydrateLibrary() (called
 * from the root route on both server and client).
 */
export const allItems: ContentItem[] = [...seedItems];

export function hydrateLibrary(data: { items: ContentItem[]; categories: Category[] } | undefined) {
  if (!data || data.items.length === 0) return;
  allItems.splice(0, allItems.length, ...data.items);
  if (data.categories.length) categories.splice(0, categories.length, ...data.categories);
}

export function itemsByType(type: ContentType): ContentItem[] {
  return allItems
    .filter((it) => it.type === type)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export function itemBySlug(type: ContentType, slug: string): ContentItem | undefined {
  return allItems.find((it) => it.type === type && it.slug === slug);
}

export function featuredItems(limit = 4): ContentItem[] {
  return allItems.filter((it) => it.featured).slice(0, limit);
}

export function itemsByCategory(categoryId: string): ContentItem[] {
  return allItems
    .filter((it) => it.categoryIds.includes(categoryId))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export function countByCategory(categoryId: string): number {
  return allItems.filter((it) => it.categoryIds.includes(categoryId)).length;
}

export function countByType(type: ContentType): number {
  return allItems.filter((it) => it.type === type).length;
}

export function categoriesWithCounts(): Array<Category & { count: number }> {
  return categories.map((c) => ({ ...c, count: countByCategory(c.id) }));
}

/** Items sharing at least one category or tag, excluding the item itself. */
export function relatedItems(item: ContentItem, limit = 3): ContentItem[] {
  const scored = allItems
    .filter((it) => it.id !== item.id)
    .map((it) => {
      let score = 0;
      for (const c of it.categoryIds) if (item.categoryIds.includes(c)) score += 2;
      for (const t of it.tags) if (item.tags.includes(t)) score += 1;
      if (it.type === item.type) score += 1;
      return { it, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.it);
}

/**
 * Arabic-aware normalization for search: strips diacritics, unifies alef and
 * ya/ta-marbuta variants, and lowercases Latin text. Display text is untouched.
 */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchHit {
  item: ContentItem;
  score: number;
}

/** Token-based scored search across title, description, tags and categories. */
export function searchItems(query: string, pool: ContentItem[] = allItems): SearchHit[] {
  const q = normalizeArabic(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);

  const hits: SearchHit[] = [];
  for (const item of pool) {
    const title = normalizeArabic(item.title);
    const desc = normalizeArabic(item.description);
    const tags = normalizeArabic(item.tags.join(" "));
    const cats = normalizeArabic(
      item.categoryIds.map((id) => categoryById(id)?.name ?? "").join(" "),
    );
    const author = normalizeArabic(item.authorName ?? "");

    let score = 0;
    let allMatched = true;
    for (const t of tokens) {
      const s =
        (title.includes(t) ? 4 : 0) +
        (tags.includes(t) ? 2 : 0) +
        (cats.includes(t) ? 2 : 0) +
        (author.includes(t) ? 1 : 0) +
        (desc.includes(t) ? 1 : 0);
      if (s === 0) {
        allMatched = false;
        break;
      }
      score += s;
    }
    if (allMatched) hits.push({ item, score });
  }
  return hits.sort(
    (a, b) =>
      b.score - a.score || (b.item.publishedAt ?? "").localeCompare(a.item.publishedAt ?? ""),
  );
}

export function formatDateAr(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
