import { describe, expect, it } from "vitest";

import { allItems, countByType, hydrateLibrary, normalizeArabic, searchItems } from "@/lib/content";
import { applyListing, parseListingSearch } from "@/lib/listing";
import { tableOfContents } from "@/components/content/Detail";

describe("Arabic search", () => {
  it("treats alef variants, ta marbuta and diacritics as equal", () => {
    expect(normalizeArabic("إِسْلامٌ")).toBe(normalizeArabic("اسلام"));
    expect(normalizeArabic("مقارنة")).toBe(normalizeArabic("مقارنه"));
  });

  it("finds real seed items and returns nothing for gibberish", () => {
    const hits = searchItems("مريم");
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.every((h) => /مريم/.test(h.item.title + h.item.description + h.item.tags.join(" "))),
    ).toBe(true);
    expect(searchItems("zzqqxx")).toHaveLength(0);
  });
});

describe("Library hydration", () => {
  it("reflects database rows in live counts, not just the bundled seed", () => {
    const original = [...allItems];
    const before = countByType("video");
    const video = original.find((i) => i.type === "video")!;
    const extra = { ...video, id: "test-extra", slug: "test-extra-slug" };
    try {
      hydrateLibrary({ items: [...original, extra], categories: [] });
      expect(countByType("video")).toBe(before + 1);
    } finally {
      hydrateLibrary({ items: original, categories: [] });
      expect(countByType("video")).toBe(before);
    }
  });
});

describe("Listing filters", () => {
  const videos = allItems.filter((i) => i.type === "video");

  it("filters by category", () => {
    const out = applyListing(videos, { cat: "christianity" });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => i.categoryIds.includes("christianity"))).toBe(true);
  });

  it("sorts newest first by default and oldest when asked", () => {
    const d = applyListing(videos, {}).map((i) => i.publishedAt ?? "");
    expect([...d].sort().reverse()).toEqual(d);
    const o = applyListing(videos, { sort: "old" }).map((i) => i.publishedAt ?? "");
    expect([...o].sort()).toEqual(o);
  });

  it("drops invalid URL params", () => {
    expect(parseListingSearch({ sort: "bogus", page: "0", q: " " })).toEqual({
      q: undefined,
      cat: undefined,
      series: undefined,
      sort: undefined,
      page: undefined,
    });
    expect(parseListingSearch({ page: "3", sort: "title" })).toMatchObject({
      page: 3,
      sort: "title",
    });
  });
});

describe("Article table of contents", () => {
  it("lists ## and ### headings", () => {
    const toc = tableOfContents("مقدمة\n\n## أولًا\n\nنص\n\n### فرع");
    expect(toc.map((t) => [t.text, t.level])).toEqual([
      ["أولًا", 2],
      ["فرع", 3],
    ]);
  });

  it("keeps every heading without requiring blank lines and excludes fenced code", () => {
    const toc = tableOfContents(
      "## المقدمة\nنص\n### **التفاصيل**\n```md\n## مثال برمجي\n```\n## المراجع",
    );
    expect(toc.map((entry) => [entry.text, entry.level])).toEqual([
      ["المقدمة", 2],
      ["التفاصيل", 3],
      ["المراجع", 2],
    ]);
    expect(new Set(toc.map((entry) => entry.id)).size).toBe(3);
  });
});
