import { describe, expect, it } from "vitest";
import { defaultSiteSettings, resolveSiteSettings, siteSettingsSchema } from "@/data/site-settings";

describe("Shared public page settings", () => {
  it("uses stored banner and section controls rather than replacing them with defaults", () => {
    const settings = structuredClone(defaultSiteSettings);
    settings.hero.image = "https://example.com/banner.jpg";
    settings.hero.search = false;
    settings.sections.books = false;
    settings.pages.books.title = "المؤلفات";
    expect(resolveSiteSettings(settings)).toMatchObject({
      hero: { image: "https://example.com/banner.jpg", search: false },
      sections: { books: false },
      pages: { books: { title: "المؤلفات" } },
    });
  });
  it("rejects unsafe banner URLs", () => {
    const settings = structuredClone(defaultSiteSettings);
    settings.hero.image = "javascript:alert(1)";
    expect(siteSettingsSchema.safeParse(settings).success).toBe(false);
  });
  it("keeps fallback defaults isolated from editing", () => {
    const settings = resolveSiteSettings(null);
    settings.sections.books = false;
    expect(defaultSiteSettings.sections.books).toBe(true);
  });
});
