import { describe, expect, it } from "vitest";

import { asDate, asTimestamp, toContentItem, toUpsertRequest } from "@/lib/api-mapping";
import type { ContentItemDto } from "@/lib/api-mapping";
import { seedItems } from "@/data/seed";

const dto = (over: Partial<ContentItemDto>): ContentItemDto => ({
  id: "v-test",
  type: "video",
  slug: "test",
  title: "اختبار",
  description: "",
  thumbnailUrl: null,
  authorName: null,
  sourceUrl: null,
  body: null,
  categoryIds: [],
  tags: [],
  featured: false,
  verified: false,
  demo: false,
  rightsStatus: "owned",
  publishedAt: null,
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
  references: [],
  documentUrl: null,
  documentFormat: null,
  ...over,
});

describe("API → UI mapping", () => {
  it("reduces a stored timestamp to the calendar date the UI formats", () => {
    expect(asDate("2023-03-22T00:00:00+00:00")).toBe("2023-03-22");
    expect(asDate(null)).toBeNull();
  });

  it("sends a bare date back as midnight UTC so ordering survives the round trip", () => {
    expect(asTimestamp("2023-03-22")).toBe("2023-03-22T00:00:00Z");
    expect(asTimestamp("2023-03-22T15:30:00Z")).toBe("2023-03-22T15:30:00Z");
    expect(asTimestamp(null)).toBeNull();
  });

  it("keeps only the fields belonging to a record's own type", () => {
    const video = toContentItem(dto({ type: "video", videoId: "abc", isbn: "should-be-dropped" }));
    expect(video.type).toBe("video");
    expect("videoId" in video).toBe(true);
    expect("isbn" in video).toBe(false);

    const research = toContentItem(dto({ type: "research", references: ["مرجع"] }));
    expect("references" in research).toBe(true);
    expect("authorizedLinks" in research).toBe(false);
  });

  it("reads a book with no stored availability as unknown rather than undefined", () => {
    const book = toContentItem(dto({ type: "book", availability: null }));
    expect(book.type === "book" && book.availability).toBe("unknown");
  });

  it("round-trips every bundled record without losing a value", () => {
    // The write model must carry everything the read model needs: build the request
    // the dashboard would send, feed it back through the reader, and the record has
    // to come out as it went in. Any field the mapper forgets fails here.
    for (const item of seedItems) {
      const request = toUpsertRequest(item, item.slug);
      const back = toContentItem(
        dto({ id: item.id, ...(request as Partial<ContentItemDto>) }),
      ) as unknown as Record<string, unknown>;

      for (const [key, value] of Object.entries(item as unknown as Record<string, unknown>)) {
        expect(back[key], `${item.id}.${key}`).toEqual(value);
      }
    }
  });
});
