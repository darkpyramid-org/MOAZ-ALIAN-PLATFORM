import { describe, expect, it } from "vitest";
import { defaultSiteSettings, heroFromSlide, resolveSiteSettings, siteSettingsSchema, slideFromHero, slidesOf } from "@/data/site-settings";

describe("Hero banner slider", () => {
  it("adds the season-schedule and social-links slides after the banner when none are saved", () => {
    const stored = { ...defaultSiteSettings, hero: { ...defaultSiteSettings.hero, title: "بانر مخصص" } } as Record<string, unknown>;
    delete stored["slides"];
    const slides = slidesOf(resolveSiteSettings(stored));
    expect(slides.map((s) => s.title)).toEqual(["بانر مخصص", "جدول الموسم", "تابعنا وتواصل معنا"]);
    expect(slides[0]?.primaryHref).toBe("/categories");
    expect(slides[2]?.links.some((l) => l.label === "واتساب" && l.href === "https://wa.me/201152060900")).toBe(true);
    expect(slides.slice(1).map((s) => s.image)).toEqual(["/images/video-cover.webp", "/images/about-cover.webp"]);
  });
  it("keeps exactly the saved slides when a list is saved, even a single one", () => {
    const first = slideFromHero(defaultSiteSettings.hero);
    const settings = resolveSiteSettings({ ...defaultSiteSettings, slides: [first] });
    expect(slidesOf(settings).map((s) => s.title)).toEqual([defaultSiteSettings.hero.title]);
  });
  it("shows every saved slide in order", () => {
    const first = slideFromHero(defaultSiteSettings.hero);
    const second = { ...first, title: "جدول الموسم" };
    const settings = resolveSiteSettings({ ...defaultSiteSettings, slides: [first, second] });
    expect(slidesOf(settings).map((s) => s.title)).toEqual([defaultSiteSettings.hero.title, "جدول الموسم"]);
  });
  it("rejects unsafe slide links so the slider never renders a javascript: link", () => {
    const first = slideFromHero(defaultSiteSettings.hero);
    const unsafe = { ...first, links: [{ label: "واتساب", href: "javascript:alert(1)" }] };
    expect(siteSettingsSchema.safeParse({ ...defaultSiteSettings, slides: [unsafe] }).success).toBe(false);
  });
  it("rejects slides without a title", () => {
    const first = { ...slideFromHero(defaultSiteSettings.hero), title: "" };
    expect(siteSettingsSchema.safeParse({ ...defaultSiteSettings, slides: [first] }).success).toBe(false);
  });
  it("maps the first slide back onto the hero banner, keeping the search toggle", () => {
    const hero = heroFromSlide({ ...slideFromHero(defaultSiteSettings.hero), image: "media/banner/new.webp" }, false);
    expect(hero.image).toBe("media/banner/new.webp");
    expect(hero.search).toBe(false);
    expect(hero.primaryLabel).toBe(defaultSiteSettings.hero.primaryLabel);
  });
});
