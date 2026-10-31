import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, ExternalLink, FileText, FlaskConical, Layers, MessagesSquare, PlayCircle, Scale, ShieldQuestion } from "lucide-react";

import { ArticleCard, BookCard, ContentCard } from "@/components/content/cards";
import { FeaturedVideo } from "@/components/content/Featured";
import { DemoBadge, SectionHeading } from "@/components/content/ui";
import { categoriesWithCounts, countByCategory, countByType, featuredItems, formatDateAr, itemsByType } from "@/lib/content";
import { allItems } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import type { ArticleItem, BookItem } from "@/types/content";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { slidesOf, type SiteSettings } from "@/data/site-settings";
import { libraryQuery } from "@/lib/library.functions";
import { HomeSkeleton } from "@/components/skeletons";

const TITLE = "معاذ عليان — مساحة معرفية للبحث والقراءة والاكتشاف";
const DESC = "اكتشف مجموعة من الفيديوهات والمقالات والكتب والمواد البحثية المرتبطة بمقارنة الأديان والقضايا الفكرية.";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(libraryQuery),
  head: ({ loaderData }) => ({
    links: [{ rel: "canonical", href: "/" }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.settings.hero.image.startsWith("https://") ? [
        { property: "og:image", content: loaderData.settings.hero.image },
        { name: "twitter:image", content: loaderData.settings.hero.image },
      ] : []),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "معاذ عليان — فضاء معرفي", inLanguage: "ar" }),
      },
    ],
  }),
  component: Index,
  pendingComponent: HomeSkeleton,
});

type Explore = { label: string; desc: string; icon: typeof PlayCircle; count: number } & (
  | { kind: "route"; to: "/videos" | "/books" | "/articles" | "/research" }
  | { kind: "cat"; id: string }
);

function buildExplore(): Explore[] {
  // Counts are computed per render: the library store is hydrated in place
  // after loader data arrives, so module-scope values would freeze at the
  // bundled seed counts and drift from the live database after staff edits.
  return [
    { kind: "route", to: "/videos", label: "الفيديوهات", desc: "حلقات وحوارات مسجّلة", icon: PlayCircle, count: countByType("video") },
    { kind: "route", to: "/books", label: "الكتب والمؤلفات", desc: "مؤلفات منشورة وروابط قراءتها", icon: BookOpen, count: countByType("book") },
    { kind: "route", to: "/articles", label: "المقالات", desc: "شروح مكتوبة للقراءة المتأنية", icon: FileText, count: countByType("article") },
    { kind: "route", to: "/research", label: "الأبحاث والدراسات", desc: "أوراق ومراجع بحثية", icon: FlaskConical, count: countByType("research") },
    { kind: "cat", id: "comparative", label: "مقارنة الأديان", desc: "العقائد والنصوص بين الأديان", icon: Scale, count: countByCategory("comparative") },
    { kind: "cat", id: "responses", label: "الشبهات والردود", desc: "ردود على ما يُثار حول الإسلام", icon: ShieldQuestion, count: countByCategory("responses") },
    { kind: "cat", id: "dialogues", label: "الحوارات والمناظرات", desc: "نقاشات مسجّلة مع المحاورين", icon: MessagesSquare, count: countByCategory("dialogues") },
    { kind: "cat", id: "series", label: "البرامج والسلاسل", desc: "برامج تعليمية مرتبة", icon: Layers, count: countByCategory("series") },
  ];
}

function ExploreCard({ e, i }: { e: Explore; i: number }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <e.icon className="size-6 text-primary" aria-hidden />
        <span className="font-latin text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
      </div>
      <p className="mt-6 font-semibold">{e.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{e.desc}</p>
      <p className="mt-4 text-xs text-primary">{e.count} مادة</p>
    </>
  );
  const cls = "card-lift block rounded-lg border border-border bg-surface p-5";
  return e.kind === "route" ? (
    <Link to={e.to} className={cls}>{inner}</Link>
  ) : (
    <Link to="/categories/$id" params={{ id: e.id }} className={cls}>{inner}</Link>
  );
}

function HeroSearch() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className="animate-rise-2 relative mt-8 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/search", search: { q: q.trim() || undefined } });
      }}
    >
      <label htmlFor="hero-search" className="sr-only">ابحث في المكتبة</label>
      <input
        id="hero-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث عن كتاب أو مقال أو فيديو أو موضوع..."
        className="field w-full py-4 ps-5 pe-28 shadow-card"
      />
      <button type="submit" className="btn-gold absolute end-2 top-1/2 -translate-y-1/2 text-sm">بحث</button>
    </form>
  );
}

function HeroSlider({ settings }: { settings: SiteSettings }) {
  const slides = slidesOf(settings);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => window.clearInterval(t);
  }, [count, paused, index]);

  // Re-key the active dot's progress bar whenever autoplay resumes, so it
  // restarts in sync with the fresh 7-second interval.
  useEffect(() => {
    if (!paused) setCycle((c) => c + 1);
  }, [paused]);

  const active = slides[Math.min(index, count - 1)] ?? slides[0]!;
  const go = (i: number) => setIndex(((i % count) + count) % count);
  const renderButton = (label: string, href: string, primary: boolean) => {
    if (!label || !href) return null;
    const external = href.startsWith("https://");
    return (
      <a key={label} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className={primary ? "btn-gold" : "btn-outline"}>
        {label} {external ? <ExternalLink className="size-4" aria-hidden /> : primary ? <ArrowLeft className="size-4" aria-hidden /> : null}
      </a>
    );
  };

  return (
    <section
      className="home-hero hero-band relative overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="بانر الصفحة الرئيسية"
      data-paused={paused}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <img
          key={i}
          src={mediaUrl(s.image, "/images/hero-library.webp")}
          alt="" aria-hidden width={1600} height={1008}
          loading={i === 0 ? undefined : "lazy"}
          fetchPriority={i === 0 ? "high" : undefined}
          data-active={i === index}
          className="hero-photo hero-slide-photo absolute inset-0 size-full object-cover"
        />
      ))}
      <div aria-hidden className="hero-scrim absolute inset-0" />
      <div className="home-hero-content container-editorial relative flex items-end">
        <div key={index} className="w-full max-w-2xl">
          <p className="animate-rise mb-4 text-sm font-semibold tracking-wide text-primary">{active.kicker}</p>
          <h1 className="animate-rise-1 text-4xl font-bold leading-[1.3] tracking-tight md:text-5xl xl:text-[4rem]">
            {active.title}
          </h1>
          <p className="animate-rise-2 mt-6 max-w-xl text-lg leading-9 text-muted-foreground">{active.intro}</p>
          {index === 0 && settings.hero.search && <HeroSearch />}
          <div className="animate-rise-3 mt-6 grid gap-3 sm:flex sm:flex-wrap">
            {renderButton(active.primaryLabel, active.primaryHref, true)}
            {renderButton(active.secondaryLabel, active.secondaryHref, false)}
            {active.links.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:basis-full">
                {active.links.map((l, li) => (
                  <a key={li} href={l.href} {...(l.href.startsWith("https://") ? { target: "_blank", rel: "noreferrer" } : {})} className="rounded-full border border-border bg-background/40 px-4 py-2 text-sm backdrop-blur transition-colors hover:border-primary hover:text-primary">
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {count > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i} type="button" aria-label={`الشريحة ${i + 1}`} aria-current={i === index}
                onClick={() => go(i)}
                className={`relative h-2 overflow-hidden rounded-full transition-all ${i === index ? "w-10 bg-muted-foreground/30" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"}`}
              >
                {i === index && <span key={`${index}-${cycle}`} className="hero-dot-progress absolute inset-y-0 start-0 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <div className="absolute bottom-4 start-6 z-10 hidden sm:block">
            <span dir="ltr" className="font-latin text-xs tracking-widest text-muted-foreground">
              {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Index() {
  const settings = useSiteSettings();
  const { sections, about } = settings;
  const featured = featuredItems(5);
  const [lead, ...rest] = featured;
  const books = itemsByType("book").slice(0, 5) as BookItem[];
  const articles = itemsByType("article").slice(0, 4) as ArticleItem[];
  const [leadArticle, ...moreArticles] = articles;
  const recent = [...allItems].filter((i) => i.publishedAt).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, 5);
  const topCats = categoriesWithCounts().filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <>
      <HeroSlider settings={settings} />


      {sections.featured && lead && (
        <section className="container-editorial section-y">
          <SectionHeading kicker="مختارات" title="محتوى مميز" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2 lg:row-span-2">
              <ContentCard item={lead} />
            </div>
            {rest.map((it) => (
              <ContentCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}

      {sections.explore && <section className="paper-section border-y border-paper-border">
        <div className="container-editorial section-y">
          <SectionHeading kicker="استكشف" title="أقسام المكتبة" href="/categories" linkLabel="كل التصنيفات" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {buildExplore().map((e, i) => (
              <ExploreCard key={e.label} e={e} i={i} />
            ))}
          </div>
        </div>
      </section>}

      {sections.video && <FeaturedVideo />}

      {sections.books && <section className="container-editorial section-y">
        <SectionHeading kicker="المكتبة" title="رفّ الكتب" href="/books" linkLabel="كل الكتب" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>}

      {sections.articles && leadArticle && (
        <section className="paper-section border-y border-paper-border">
          <div className="container-editorial section-y">
            <SectionHeading kicker="قراءة" title="أحدث المقالات" href="/articles" linkLabel="كل المقالات" />
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <ArticleCard article={leadArticle} />
              <div className="grid gap-4">
                {moreArticles.map((a) => (
                  <ArticleCard key={a.id} article={a} horizontal />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {sections.recent && <section className="container-editorial grid gap-10 section-y lg:grid-cols-2">
        <div className="min-w-0">
          <SectionHeading kicker="تابع الاستكشاف" title="أُضيف مؤخرًا" />
          <ol className="divide-y divide-border border-y border-border">
            {recent.map((it) => (
              <li key={it.id}>
                <Link
                  to={it.type === "video" ? "/videos/$slug" : it.type === "book" ? "/books/$slug" : it.type === "article" ? "/articles/$slug" : "/research/$slug"}
                  params={{ slug: it.slug }}
                  className="group flex items-center justify-between gap-4 py-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:text-primary">{it.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDateAr(it.publishedAt)}</span>
                  </span>
                  {it.demo ? <DemoBadge /> : <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" aria-hidden />}
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <div className="min-w-0">
          <SectionHeading kicker="حسب الموضوع" title="تصفّح الموضوعات" />
          <div className="flex flex-wrap gap-2">
            {topCats.map((c) => (
              <Link key={c.id} to="/categories/$id" params={{ id: c.id }} className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary">
                {c.name} <span className="text-xs text-muted-foreground">({c.count})</span>
              </Link>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-border bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-primary">عن المشروع</p>
            <p className="mt-3 leading-8 text-muted-foreground">
              {about.teaser}
            </p>
            <Link to="/about" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              اقرأ المزيد <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>}
    </>
  );
}
