import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Play } from "lucide-react";

import { DemoBadge, TypeKicker } from "@/components/content/ui";
import { VideoThumb } from "@/components/content/cards";
import { categoryById } from "@/data/categories";
import { formatDateAr, formatDuration, itemsByType } from "@/lib/content";
import type { ArticleItem, VideoItem } from "@/types/content";

export function featuredOf<T extends { featured: boolean }>(list: T[]): T | undefined {
  return list.find((i) => i.featured) ?? list[0];
}

export function FeaturedArticle() {
  const a = featuredOf(itemsByType("article") as ArticleItem[]);
  if (!a) return null;
  const cat = categoryById(a.categoryIds[0] ?? "");
  return (
    <section className="container-editorial pt-10" aria-label="مقال مميز">
      <Link
        to="/articles/$slug"
        params={{ slug: a.slug }}
        className="card-lift group grid overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[1fr_1.4fr]"
      >
        <div className="flex min-h-48 bg-deep flex-col justify-end gap-3 p-8">
          <span className="text-xs font-semibold tracking-widest text-primary">مقال مميز</span>
          <span className="gold-rule" aria-hidden />
          {cat && <span className="text-sm text-muted-foreground">{cat.name}</span>}
        </div>
        <div className="p-8">
          <TypeKicker type="article" />
          <h2 className="mt-2 text-2xl font-bold leading-snug group-hover:text-primary">
            {a.title}
          </h2>
          <p className="mt-3 leading-8 text-muted-foreground">{a.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {formatDateAr(a.publishedAt) && <span>{formatDateAr(a.publishedAt)}</span>}
            {a.demo && <DemoBadge />}
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              اقرأ المقال{" "}
              <ArrowLeft
                className="size-4 transition-transform group-hover:-translate-x-1"
                aria-hidden
              />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}

export function FeaturedVideo() {
  const v = featuredOf(itemsByType("video") as VideoItem[]);
  if (!v) return null;
  const dur = formatDuration(v.durationSeconds);
  return (
    <section className="border-y border-border bg-deep">
      <div className="container-editorial grid items-center gap-10 section-y lg:grid-cols-[1.4fr_1fr]">
        <Link
          to="/videos/$slug"
          params={{ slug: v.slug }}
          className="group relative block overflow-hidden rounded-lg"
          aria-label={`مشاهدة: ${v.title}`}
        >
          <div className="transition-transform duration-300 group-hover:scale-[1.02]">
            <VideoThumb title={v.title} />
          </div>
        </Link>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-primary">فيديو مختار</p>
          <h2 className="text-2xl font-bold leading-snug md:text-3xl">{v.title}</h2>
          <p className="mt-4 leading-8 text-muted-foreground">{v.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {formatDateAr(v.publishedAt) && <span>{formatDateAr(v.publishedAt)}</span>}
            {dur && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" aria-hidden /> {dur}
              </span>
            )}
          </div>
          <Link to="/videos/$slug" params={{ slug: v.slug }} className="btn-gold mt-6">
            <Play className="size-4" aria-hidden /> شاهد الحلقة
          </Link>
        </div>
      </div>
    </section>
  );
}
