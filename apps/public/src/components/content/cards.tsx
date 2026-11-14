import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Play } from "lucide-react";

import { DemoBadge, SourceTag, TypeKicker } from "@/components/content/ui";
import { formatDateAr } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import {
  TYPE_LABELS,
  type ArticleItem,
  type BookItem,
  type ContentItem,
  type ResearchItem,
  type VideoItem,
} from "@/types/content";

/** Typographic fallback cover used when no authorized cover is available or it fails to load. */
function TypographicCover({ title, className }: { title: string; className?: string | undefined }) {
  return (
    <div
      className={`relative flex aspect-[2/3] grow flex-col items-center justify-center gap-3 overflow-hidden border border-border p-6 text-center ${className ?? ""}`}
    >
      <img
        src="/images/book-cover.webp"
        alt=""
        aria-hidden
        width={480}
        height={720}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
      <span className="relative text-[11px] font-semibold tracking-widest text-primary">كتاب</span>
      <span className="gold-rule relative" aria-hidden />
      <span className="relative line-clamp-4 text-sm font-semibold leading-7 text-media-foreground">
        {title}
      </span>
    </div>
  );
}

export function BookCover({ book, className }: { book: BookItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  const cover = book.coverUrl || book.thumbnailUrl;
  if (!cover || failed) return <TypographicCover title={book.title} className={className} />;
  return (
    <img
      src={mediaUrl(cover)}
      alt={`غلاف كتاب ${book.title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-[2/3] w-full grow border-0 border-b border-border bg-surface object-cover ${className ?? ""}`}
    />
  );
}

export function ContentImage({
  src,
  fallback,
  title,
  rounded = false,
}: {
  src: string | null;
  fallback: string;
  title: string;
  rounded?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`aspect-video grow overflow-hidden border-border bg-media-deep ${rounded ? "rounded-2xl border shadow-card" : "border-b"}`}
    >
      <img
        src={failed ? fallback : mediaUrl(src, fallback)}
        alt={src && !failed ? title : ""}
        onError={() => setFailed(true)}
        width={960}
        height={540}
        loading="lazy"
        className="size-full object-contain transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
}

export function VideoThumb({
  title,
  rounded = false,
  thumbnailUrl,
}: {
  title: string;
  rounded?: boolean;
  thumbnailUrl?: string | null;
}) {
  if (thumbnailUrl)
    return (
      <ContentImage
        src={thumbnailUrl}
        fallback="/images/video-cover.webp"
        title={title}
        rounded={rounded}
      />
    );
  return (
    <div
      className={`relative aspect-video w-full grow overflow-hidden bg-media-deep ${rounded ? "rounded-2xl border border-border shadow-card" : ""}`}
    >
      <img
        src="/images/video-cover.webp"
        alt=""
        aria-hidden
        width={960}
        height={540}
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-media-deep/80 via-media-deep/20 to-transparent"
      />
      <span aria-hidden className="absolute top-4 start-5 h-1 w-10 rounded-full bg-primary/60" />
      <span aria-hidden className="absolute top-7 start-5 h-1 w-16 rounded-full bg-primary/25" />
      <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full border border-primary/60 bg-media-deep/40">
        <Play className="size-6 text-primary" aria-hidden />
      </span>
      <span className="absolute bottom-0 inset-x-0 truncate bg-media-deep/60 px-3 py-1.5 text-[11px] text-media-foreground">
        {title}
      </span>
    </div>
  );
}

function Meta({ date }: { date: string | null }) {
  const d = formatDateAr(date);
  if (!d) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CalendarDays className="size-3.5" aria-hidden />
      {d}
    </span>
  );
}

export function VideoCard({ video }: { video: VideoItem }) {
  return (
    <Link
      to="/videos/$slug"
      params={{ slug: video.slug }}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      <VideoThumb title={video.title} thumbnailUrl={video.thumbnailUrl} />
      <div className="flex flex-col p-4">
        <TypeKicker type="video" />
        <h3 className="mt-1 line-clamp-2 font-semibold leading-7 group-hover:text-gold-soft">
          {video.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Meta date={video.publishedAt} />
          {video.demo && <DemoBadge />}
        </div>
      </div>
    </Link>
  );
}

export function BookCard({ book }: { book: BookItem }) {
  return (
    <Link
      to="/books/$slug"
      params={{ slug: book.slug }}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      <BookCover book={book} />
      <div className="flex flex-col p-4">
        <TypeKicker type="book" />
        <h3 className="mt-1 line-clamp-2 font-semibold leading-7 group-hover:text-gold-soft">
          {book.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {book.demo ? <DemoBadge /> : <SourceTag verified={book.verified} />}
          <span className="text-xs text-muted-foreground">{TYPE_LABELS.book}</span>
        </div>
      </div>
    </Link>
  );
}

export function ArticleCard({
  article,
  horizontal = false,
}: {
  article: ArticleItem;
  horizontal?: boolean;
}) {
  const inner = (
    <>
      {!horizontal && (
        <ContentImage
          src={article.thumbnailUrl}
          fallback="/images/article-cover.webp"
          title={article.title}
        />
      )}
      <div className="flex flex-col p-5">
        <TypeKicker type="article" />
        <h3 className="mt-1 font-semibold leading-8 group-hover:text-gold-soft">{article.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{article.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
          <Meta date={article.publishedAt} />
          {article.readingTimeMinutes != null && (
            <span className="text-xs text-muted-foreground">
              {article.readingTimeMinutes} دقائق قراءة
            </span>
          )}
          {article.demo && <DemoBadge />}
        </div>
      </div>
    </>
  );
  return (
    <Link
      to="/articles/$slug"
      params={{ slug: article.slug }}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      {inner}
    </Link>
  );
}

export function ResearchCard({ item }: { item: ResearchItem }) {
  return (
    <Link
      to="/research/$slug"
      params={{ slug: item.slug }}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface"
    >
      <ContentImage
        src={item.thumbnailUrl}
        fallback="/images/research-cover.webp"
        title={item.title}
      />
      <div className="flex flex-col p-5">
        <TypeKicker type="research" />
        <h3 className="mt-1 font-semibold leading-8 group-hover:text-gold-soft">{item.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground">
          <span>
            {item.documentUrl
              ? `ملف متاح${item.documentFormat ? ` (${item.documentFormat})` : ""}`
              : "لا يتوفر ملف"}
          </span>
          {item.references.length > 0 && <span>{item.references.length} مرجعًا</span>}
          {item.demo && <DemoBadge />}
        </div>
      </div>
    </Link>
  );
}

export function ContentCard({ item }: { item: ContentItem }) {
  switch (item.type) {
    case "video":
      return <VideoCard video={item} />;
    case "book":
      return <BookCard book={item} />;
    case "article":
      return <ArticleCard article={item} />;
    case "research":
      return <ResearchCard item={item} />;
  }
}
