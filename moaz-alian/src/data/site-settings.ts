import { z } from "zod";

const image = z.string().refine((s) => s === "" || /^\/images\/[\w./-]+$/.test(s) || /^media\/[\w][\w./-]*$/.test(s) || /^https:\/\//.test(s), "استخدم رابط صورة آمنًا");
const href = z.string().refine((s) => s === "" || s.startsWith("/") || /^https:\/\//.test(s), "استخدم رابطًا يبدأ بـ / أو https://");
const page = z.object({ kicker: z.string().max(120), title: z.string().trim().min(1).max(160), intro: z.string().max(1200) });
export const slideLinkSchema = z.object({ label: z.string().trim().min(1, "أدخل اسم الرابط").max(80), href });
export const heroSlideSchema = z.object({
  kicker: z.string().max(120), title: z.string().trim().min(1, "أدخل عنوان الشريحة").max(160), intro: z.string().max(1200), image,
  primaryLabel: z.string().max(80), primaryHref: href, secondaryLabel: z.string().max(80), secondaryHref: href,
  links: z.array(slideLinkSchema).max(6, "6 روابط كحد أقصى لكل شريحة"),
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type HeroSlideLink = z.infer<typeof slideLinkSchema>;
export const sectionKeys = ["featured", "explore", "video", "books", "articles", "recent"] as const;
export const pageKeys = ["videos", "books", "articles", "research", "categories"] as const;
export const siteSettingsSchema = z.object({
  hero: page.extend({ image, primaryLabel: z.string().max(80), secondaryLabel: z.string().max(80), search: z.boolean() }),
  slides: z.array(heroSlideSchema).max(10).optional(),
  sections: z.object({ featured: z.boolean(), explore: z.boolean(), video: z.boolean(), books: z.boolean(), articles: z.boolean(), recent: z.boolean() }),
  pages: z.object({ videos: page, books: page, articles: page, research: page, categories: page }),
  about: page.extend({ image, imageAlt: z.string().max(300), body: z.string().max(30000), teaser: z.string().max(1200) }),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
const defaultHero: SiteSettings["hero"] = { kicker: "مكتبة معرفية مستقلة · معاذ عليان", title: "مساحة معرفية للبحث والقراءة والاكتشاف", intro: "اكتشف مجموعة من الفيديوهات والمقالات والكتب والمواد البحثية المرتبطة بمقارنة الأديان والقضايا الفكرية.", image: "/images/hero-library.webp", primaryLabel: "استكشف المكتبة", secondaryLabel: "تصفح الفيديوهات", search: true };
const defaultScheduleSlide: HeroSlide = {
  kicker: "برنامج الموسم", title: "جدول الموسم", intro: "", image: "/images/video-cover.webp",
  primaryLabel: "", primaryHref: "", secondaryLabel: "", secondaryHref: "",
  links: [
    { label: "فهرس الحلقات (تنوير)", href: "https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/" },
    { label: "قناة يوتيوب", href: "https://www.youtube.com/channel/UCZgb3h-QHvK8abuJzs73vag" },
  ],
};
const defaultSocialSlide: HeroSlide = {
  kicker: "تواصل", title: "تابعنا وتواصل معنا", intro: "تابع الجديد عبر المنصات، أو أرسل رسالة مباشرة على واتساب.", image: "/images/about-cover.webp",
  primaryLabel: "", primaryHref: "", secondaryLabel: "", secondaryHref: "",
  links: [
    { label: "واتساب", href: "https://wa.me/201152060900" },
    { label: "قناة يوتيوب", href: "https://www.youtube.com/channel/UCZgb3h-QHvK8abuJzs73vag" },
    { label: "إسلام لاند — صفحة المؤلف", href: "https://www.islamland.com/ose/authors/731" },
    { label: "Clubhouse", href: "https://www.clubhouse.com/@moazalian" },
    { label: "Patreon", href: "https://www.patreon.com/moazalian/about" },
  ],
};
const defaultExtraSlides: HeroSlide[] = [defaultScheduleSlide, defaultSocialSlide];
export const defaultSiteSettings: SiteSettings = {
  hero: defaultHero,
  slides: [slideFromHero(defaultHero), ...defaultExtraSlides],
  sections: { featured: true, explore: true, video: true, books: true, articles: true, recent: true },
  pages: {
    videos: { kicker: "مرئيات", title: "الفيديوهات", intro: "حلقات وحوارات مسجّلة في مقارنة الأديان والرد على الشبهات، مع روابط مشاهدتها في مصادرها الأصلية." },
    books: { kicker: "المكتبة", title: "الكتب", intro: "كتب ومؤلفات منشورة، مع روابط القراءة المتاحة من مصادر معتمدة." },
    articles: { kicker: "قراءة", title: "المقالات", intro: "مقالات وشروح مكتوبة بتجربة قراءة عربية مريحة." },
    research: { kicker: "دراسات", title: "الأبحاث", intro: "أوراق بحثية ومجموعات مراجع في النصوص الدينية ومقارنة الأديان." },
    categories: { kicker: "فهرس", title: "التصنيفات", intro: "كل موضوع يجمع الفيديوهات والكتب والمقالات والأبحاث المتعلقة به." },
  },
  about: { kicker: "تعريف", title: "عن معاذ عليان", intro: "باحث ومحاور عربي يقدّم محتوى في مقارنة الأديان والرد على الشبهات.", image: "/images/about-cover.webp", imageAlt: "مكتب قراءة بإضاءة مصباح ذهبي فوق كتاب مفتوح", teaser: "يقدّم معاذ عليان محتوى في مقارنة الأديان والرد على الشبهات. هذه المكتبة مشروع مستقل غير رسمي يجمع المواد المنشورة للعموم ويحيل إلى مصادرها.", body: "يقدّم معاذ عليان حلقات مرئية وحوارات ومؤلفات تتناول مقارنة الأديان، ودراسة النصوص الدينية، والرد على الشبهات المثارة حول الإسلام، وتُنشر موادّه على عدد من المنصات العامة.\n\n## عن هذه المكتبة\n\nهذا الموقع مشروع مستقل لتنظيم المواد المنشورة للعموم وتسهيل الوصول إليها، وهو **ليس موقعًا رسميًا** ولا يمثل معاذ عليان أو يتحدث باسمه.\n\n- نربط دائمًا إلى المصدر الأصلي لكل مادة.\n- لا نعيد نشر نصوص أو صور محمية دون إذن.\n- المواد الموسومة «محتوى تجريبي» أمثلة لعرض التصميم وستُستبدل بمواد حقيقية." },
};
export function resolveSiteSettings(data: unknown): SiteSettings {
  const result = siteSettingsSchema.safeParse(data);
  if (!result.success) return structuredClone(defaultSiteSettings);
  const settings = result.data;
  // Stored settings saved before the slider existed get the banner plus the
  // season-schedule and social-links slides; any saved slides list wins as-is.
  if (!settings.slides?.length) settings.slides = [slideFromHero(settings.hero), ...defaultExtraSlides];
  return settings;
}
export function slideFromHero(hero: SiteSettings["hero"]): HeroSlide {
  return { kicker: hero.kicker, title: hero.title, intro: hero.intro, image: hero.image, primaryLabel: hero.primaryLabel, primaryHref: "/categories", secondaryLabel: hero.secondaryLabel, secondaryHref: "/videos", links: [] };
}
export function heroFromSlide(slide: HeroSlide, search: boolean): SiteSettings["hero"] {
  return { kicker: slide.kicker, title: slide.title, intro: slide.intro, image: slide.image, primaryLabel: slide.primaryLabel, secondaryLabel: slide.secondaryLabel, search };
}
export function slidesOf(settings: SiteSettings): HeroSlide[] {
  return settings.slides && settings.slides.length > 0 ? settings.slides : [slideFromHero(settings.hero)];
}
