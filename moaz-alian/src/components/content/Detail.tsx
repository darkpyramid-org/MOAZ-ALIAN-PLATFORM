import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { tableOfContents } from "@/data/detail-content";
export { tableOfContents, slugifyHeading } from "@/data/detail-content";
export type { TocEntry } from "@/data/detail-content";

import { RETURN_KEY } from "@/components/content/Listing";

import { ContentCard } from "@/components/content/cards";
import { ShareButton } from "@/components/content/ShareButton";
import { Breadcrumbs, DemoBadge, SourceTag, TypeKicker } from "@/components/content/ui";
import { categoryById } from "@/data/categories";
import { allItems, formatDateAr, relatedItems } from "@/lib/content";
import { TYPE_ROUTES, type ContentItem } from "@/types/content";

const SECTION: Record<ContentItem["type"], string> = {
  video: "الفيديوهات",
  book: "الكتب",
  article: "المقالات",
  research: "الأبحاث",
};

function ReturnLink({ item }: { item: ContentItem }) {
  const base = TYPE_ROUTES[item.type];
  const [href, setHref] = useState<string>(base);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RETURN_KEY);
      if (saved && (saved === base || saved.startsWith(base + "?") || saved.startsWith("/categories") || saved.startsWith("/search"))) setHref(saved);
    } catch {
      /* storage unavailable */
    }
  }, [base]);
  return (
    <a href={href} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
      <ArrowRight className="size-4" aria-hidden />
      العودة إلى النتائج
    </a>
  );
}

export function DetailShell({
  item,
  aside,
  children,
  wide = true,
  extra,
}: {
  item: ContentItem;
  aside?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
  extra?: ReactNode;
}) {
  const related = relatedItems(item, 3);
  const date = formatDateAr(item.publishedAt);
  return (
    <article>
      <header className="hero-band">
        <div className="container-editorial py-8 md:py-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <Breadcrumbs
                items={[
                  { label: "الرئيسية", to: "/" },
                  { label: SECTION[item.type], to: TYPE_ROUTES[item.type] },
                  { label: item.title },
                ]}
              />
            </div>
            <div className="shrink-0">
              <ReturnLink item={item} />
            </div>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <TypeKicker type={item.type} />
                {item.demo && <DemoBadge />}
                <SourceTag verified={item.verified} />
              </div>
              <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-snug tracking-tight md:text-4xl">{item.title}</h1>
              {item.description && <p className="mt-4 max-w-3xl whitespace-pre-line break-words leading-8 text-muted-foreground">{item.description}</p>}
            </div>
            <div className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5 backdrop-blur">
              <dl className="space-y-2 text-sm">
                {date && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">تاريخ النشر</dt>
                    <dd className="font-medium">{date}</dd>
                  </div>
                )}
                {item.authorName && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">بواسطة</dt>
                    <dd className="font-medium">{item.authorName}</dd>
                  </div>
                )}
              </dl>
              {item.categoryIds.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
                  {item.categoryIds.map((id) => {
                    const c = categoryById(id);
                    return c ? (
                      <Link key={id} to="/categories/$id" params={{ id }} className="rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                        {c.name}
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
                <ShareButton title={item.title} />
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-gold px-3 text-sm">
                    المصدر الأصلي
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className={`container-editorial grid gap-8 section-y-sm lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 ${wide ? "" : "xl:grid-cols-[minmax(0,48rem)_20rem] xl:justify-between"}`}>
        <div className="min-w-0">{children}</div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {aside}
          {item.tags.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-3 text-sm font-semibold">الوسوم</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((t) => (
                  <Link key={t} to="/search" search={{ q: t }} className="rounded-full bg-deep px-3 py-1 text-xs transition-colors text-muted-foreground hover:text-primary">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      {extra}
      {related.length > 0 && (
        <section className="paper-section border-t border-paper-border">
          <div className="container-editorial section-y-sm">
            <h2 className="mb-6 text-2xl font-bold">مواد ذات صلة</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <ContentCard key={r.id} item={r} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

export const RIGHTS: Record<ContentItem["rightsStatus"], string> = { owned: "مملوك للمؤلف", licensed: "مرخّص", external: "منشور خارجيًا", unknown: "غير محدد" };

export function sourceHost(url: string | null) {
  if (!url) return null;
  try { return decodeURIComponent(new URL(url).hostname.replace(/^www\./, "")); } catch { return null; }
}

/** Rights + source rows, for a page's sidebar metadata list. */
export function sourceRows(item: ContentItem): [string, ReactNode][] {
  const src = sourceHost(item.sourceUrl);
  return [
    ["الحقوق", RIGHTS[item.rightsStatus]],
    ["المصدر", src && item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-primary hover:underline">{src}</a> : null],
  ];
}

export function MetaList({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== "");
  if (!shown.length) return null;
  return (
    <dl className="rounded-2xl border border-border bg-surface p-5 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-border py-2 last:border-0">
          <dt className="break-words text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-end">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Render complete stored Markdown safely; raw HTML is never executed. */
export function ArticleBody({ body }: { body: string }) {
  const headings = tableOfContents(body);
  const headingId = (line: number | undefined) => {
    if (line == null) return undefined;
    return tableOfContents(body.split("\n").slice(0, line).join("\n")).at(-1)?.id;
  };
  return (
    <div className="prose-ar min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        h1: ({ children }) => <h2>{children}</h2>,
        h2: ({ node, children }) => <h2 id={headings.length ? headingId(node?.position?.start.line) : undefined} className="scroll-mt-24">{children}</h2>,
        h3: ({ node, children }) => <h3 id={headingId(node?.position?.start.line)} className="scroll-mt-24">{children}</h3>,
        a: ({ href, children }) => <a href={href} target={href?.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer" className="text-primary underline underline-offset-4">{children}</a>,
        ol: ({ children }) => <ol className="list-decimal space-y-2 ps-6">{children}</ol>,
        ul: ({ children }) => <ul className="list-disc space-y-2 ps-6">{children}</ul>,
        th: ({ children }) => <th className="border border-border bg-surface p-3 text-start">{children}</th>,
        td: ({ children }) => <td className="border border-border p-3">{children}</td>,
        table: ({ children }) => <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>,
        pre: ({ children }) => <pre dir="ltr" className="overflow-x-auto rounded-lg bg-surface p-4 text-start">{children}</pre>,
      }}>{body}</ReactMarkdown>
    </div>
  );
}

export function notFoundMeta(label: string) {
  return { meta: [{ title: `${label} غير موجود` }, { name: "robots", content: "noindex" }] };
}

const LD_TYPE: Record<ContentItem["type"], string> = {
  video: "VideoObject",
  book: "Book",
  article: "Article",
  research: "ScholarlyArticle",
};

function jsonLd(item: ContentItem) {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": LD_TYPE[item.type],
    name: item.title,
    headline: item.title,
    description: item.description,
    inLanguage: "ar",
  };
  if (item.authorName) base["author"] = { "@type": "Person", name: item.authorName };
  if (item.publishedAt) base[item.type === "video" ? "uploadDate" : "datePublished"] = item.publishedAt;
  if (item.sourceUrl) base["sameAs"] = item.sourceUrl;
  if (item.type === "book" && item.isbn) base["isbn"] = item.isbn;
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: "/" },
      { "@type": "ListItem", position: 2, name: SECTION[item.type], item: TYPE_ROUTES[item.type] },
      { "@type": "ListItem", position: 3, name: item.title },
    ],
  };
  // Demo records are not real publications: describe only the breadcrumb for them.
  return item.demo ? [crumbs] : [base, crumbs];
}

export function relatedOfType(item: ContentItem, type: ContentItem["type"], limit = 3) {
  return allItems
    .filter((it) => it.type === type && it.id !== item.id && it.categoryIds.some((c) => item.categoryIds.includes(c)))
    .slice(0, limit);
}

export function detailHead(item: ContentItem | undefined, label: string) {
  if (!item) return notFoundMeta(label);
  const title = `${item.title} — معاذ عليان`;
  const image = item.type === "book" ? item.coverUrl || item.thumbnailUrl : item.thumbnailUrl;
  return {
    scripts: jsonLd(item).map((d) => ({ type: "application/ld+json", children: JSON.stringify(d) })),
    links: [{ rel: "canonical", href: `${TYPE_ROUTES[item.type]}/${item.slug}` }],
    meta: [
      { title },
      { name: "description", content: item.description },
      { property: "og:title", content: title },
      { property: "og:description", content: item.description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(image?.startsWith("https://") ? [
        { property: "og:image", content: image },
        { name: "twitter:image", content: image },
      ] : []),
    ],
  };
}

/** Sticky table of contents built from the stored Markdown headings. */
export function TocNav({ body, label = "محتويات الصفحة" }: { body: string | null | undefined; label?: string }) {
  const toc = body ? tableOfContents(body) : [];
  if (!toc.length) return null;
  return (
    <nav aria-label={label} className="rounded-2xl border border-border bg-surface p-5">
      <p className="mb-3 text-sm font-semibold">{label}</p>
      <ol className="space-y-2 text-sm">
        {toc.map((t) => (
          <li key={t.id} className={t.level === 3 ? "ps-4" : ""}>
            <a href={`#${t.id}`} className="text-muted-foreground transition-colors hover:text-primary">{t.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Key facts shown in the main column so details are visible before the sidebar on small screens. */
export function FactGrid({ facts }: { facts: [string, ReactNode][] }) {
  const shown = facts.filter(([, v]) => v != null && v !== "");
  if (!shown.length) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-border bg-surface p-4">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-1 break-words font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Full stored details for any item type; shows an explicit empty state instead of invented text. */
export function DetailBody({ item, heading, emptyText }: { item: ContentItem; heading: string; emptyText: string }) {
  return (
    <section aria-labelledby="detail-body-heading" className="space-y-4">
      <h2 id="detail-body-heading" className="text-xl font-bold">{heading}</h2>
      {item.body?.trim() ? (
        <ArticleBody body={item.body} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm leading-7 text-muted-foreground">
          <p>{emptyText}</p>
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 text-sm">
              عرض المصدر الأصلي <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
        </div>
      )}
    </section>
  );
}

/** Other records of the same type that share the series or author. */
export function SiblingList({ title, items }: { title: string; items: ContentItem[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-3 text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`${TYPE_ROUTES[it.type]}/${it.slug}`} className="line-clamp-2 leading-6 text-muted-foreground transition-colors hover:text-primary">{it.title}</a>
            {it.publishedAt && <span className="text-xs text-muted-foreground/80">{formatDateAr(it.publishedAt)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function siblings(item: ContentItem, match: (it: ContentItem) => boolean, limit = 5) {
  return allItems.filter((it) => it.type === item.type && it.id !== item.id && match(it)).slice(0, limit);
}
