import { describe, expect, it } from "vitest";
import { isMediaPath, mediaUrl } from "@/lib/media";

describe("mediaUrl", () => {
  it("maps uploaded media paths to the app media route", () => {
    expect(mediaUrl("media/banner/abc123.jpg")).toBe("/api/media/media/banner/abc123.jpg");
  });

  it("leaves bundled and external image URLs unchanged", () => {
    expect(mediaUrl("/images/hero-library.webp")).toBe("/images/hero-library.webp");
    expect(mediaUrl("https://example.com/pic.jpg")).toBe("https://example.com/pic.jpg");
  });

  it("uses the fallback when the value is empty", () => {
    expect(mediaUrl("", "/images/hero-library.webp")).toBe("/images/hero-library.webp");
    expect(mediaUrl(null)).toBe("");
  });
});

describe("isMediaPath", () => {
  it("accepts safe uploaded paths and rejects traversal attempts", () => {
    expect(isMediaPath("media/content/1712345.png")).toBe(true);
    expect(isMediaPath("https://example.com/pic.jpg")).toBe(false);
    expect(isMediaPath("media/../secret.jpg")).toBe(false);
    expect(isMediaPath("")).toBe(false);
  });
});
