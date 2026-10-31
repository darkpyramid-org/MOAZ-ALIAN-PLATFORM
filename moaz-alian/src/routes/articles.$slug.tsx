import { ErrorScreen, MissingItemScreen } from "@/components/feedback/StatusScreens";
import { useEffect, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { ArticleBody, DetailShell, MetaList, detailHead, relatedOfType, sourceRows, tableOfContents } from "@/components/content/Detail";
import { ContentImage, VideoCard } from "@/components/content/cards";
import { itemBySlug } from "@/lib/content";
import type { ArticleItem, VideoItem } from "@/types/content";

export const Route = createFileRoute("/articles/$slug")({
  loader: ({ params }) => {
    const item = itemBySlug("article", params.slug) as ArticleItem | undefined;
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => detailHead(loaderData?.item, "المقال"),
  component: Page,
  notFoundComponent: () => <MissingItemScreen label="المقال" listTo="/articles" listLabel="المقالات" />,
  errorComponent: ErrorScreen,
});

function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-right bg-primary"
      style={{ transform: `scaleX(${p})` }}
      role="progressbar"
      aria-label="تقدم القراءة"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    />
  );
}

function Page() {
  const { item } = Route.useLoaderData();
  const toc = item.body ? tableOfContents(item.body) : [];
  const videos = relatedOfType(item, "video", 3) as VideoItem[];

  return (
    <>
      <ReadingProgress />
      <DetailShell
        item={item}
        wide={false}
        aside={
          <>
            {toc.length > 0 && (
              <nav aria-label="محتويات المقال" className="rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-24">
                <p className="mb-3 text-sm font-semibold">محتويات المقال</p>
                <ol className="space-y-2 text-sm">
                  {toc.map((t) => (
                    <li key={t.id} className={t.level === 3 ? "ps-4" : ""}>
                      <a href={`#${t.id}`} className="text-muted-foreground transition-colors hover:text-primary">
                        {t.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <MetaList
              rows={[
                ["الكاتب", item.authorName],
                ["مدة القراءة", item.readingTimeMinutes != null ? `${item.readingTimeMinutes} دقائق` : null],
                ...sourceRows(item),
              ]}
            />
          </>
        }
        extra={
          videos.length > 0 ? (
            <section className="container-editorial pb-12">
              <h2 className="mb-6 text-2xl font-bold">فيديوهات ذات صلة</h2>
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                {videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </section>
          ) : null
        }
      >
        {item.thumbnailUrl && <div className="mb-8"><ContentImage src={item.thumbnailUrl} fallback="/images/article-cover.webp" title={item.title} rounded /></div>}
        {item.body ? (
          <ArticleBody body={item.body} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="leading-8 text-muted-foreground">
              {item.sourceUrl ? "نص المقال الكامل غير متوفر هنا. يمكنك الرجوع إلى المصدر الأصلي لقراءته." : "لم يُضف النص الكامل لهذا المقال بعد."}
            </p>
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-gold mt-4 text-sm">
                قراءة المقال في مصدره <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
          </div>
        )}
      </DetailShell>
    </>
  );
}
