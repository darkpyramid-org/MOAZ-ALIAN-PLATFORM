import { describe, expect, it } from "vitest";
import { parseDateValue, serializeDateValue } from "@/lib/date-value";

describe("date-only form values", () => {
  it("round-trips dates without a timezone shift", () => {
    const date = parseDateValue("2026-10-30");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(30);
    expect(serializeDateValue(date)).toBe("2026-10-30");
  });
  it("supports clearing optional dates", () => {
    expect(parseDateValue("")).toBeUndefined();
    expect(parseDateValue(null)).toBeUndefined();
    expect(serializeDateValue(undefined)).toBe("");
  });
  it("rejects malformed and impossible dates", () => {
    for (const value of ["2026-02-30", "2026-13-01", "bad", "2026-1-2"]) {
      expect(parseDateValue(value)).toBeUndefined();
    }
  });
  it("preserves leap days", () => {
    expect(serializeDateValue(parseDateValue("2024-02-29"))).toBe("2024-02-29");
    expect(parseDateValue("2025-02-29")).toBeUndefined();
  });
});
