import { describe, expect, it } from "vitest";
import { isValidMediaObjectPath } from "@/lib/media/object-path";

describe("isValidMediaObjectPath", () => {
  it("accepts normal media paths", () => {
    expect(isValidMediaObjectPath("media/covers/book-1.png")).toBe(true);
    expect(isValidMediaObjectPath("media/a")).toBe(true);
  });

  it("rejects traversal and invalid shapes", () => {
    expect(isValidMediaObjectPath("media/../secret")).toBe(false);
    expect(isValidMediaObjectPath("../media/x")).toBe(false);
    expect(isValidMediaObjectPath("/media/x")).toBe(false);
    expect(isValidMediaObjectPath("other/bucket/x")).toBe(false);
    expect(isValidMediaObjectPath("")).toBe(false);
  });
});
