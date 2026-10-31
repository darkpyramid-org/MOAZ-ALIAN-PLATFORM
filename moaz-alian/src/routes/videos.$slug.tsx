import { ErrorScreen, MissingItemScreen } from "@/components/feedback/StatusScreens";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { DetailBody, DetailShell, FactGrid, MetaList, SiblingList, TocNav, detailHead, siblings, sourceRows } from "@/components/content/Detail";
import { VideoThumb } from "@/components/content/cards";
import { formatDateAr, formatDuration, itemBySlug } from "@/lib/content";
import type { VideoItem } from "@/types/content";

export const Route = createFileRoute("/videos/$slug")({
  loader: ({ params }) => {
    const item = itemBySlug("video", params.slug) as VideoItem | undefined;
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => detailHead(loaderData?.item, "الفيديو"),
  component: Page,
  notFoundComponent: () => <MissingItemScreen label="الفيديو" listTo="/videos" listLabel="الفيديوهات" />,
  errorComponent: ErrorScreen,
});

function Page() {
  const { item } = Route.useLoaderData();
  const more = item.seriesName
    ? siblings(item, (it) => it.type === "video" && it.seriesName === item.seriesName)
    : siblings(item, (it) => it.categoryIds.some((c) => item.categoryIds.includes(c)));
  return (
    <DetailShell
      item={item}
      aside={
        <>
        <TocNav body={item.body} label="محتويات الحلقة" />
        <MetaList
          rows={[
            ["المقدّم", item.authorName],
            ["المدة", formatDuration(item.durationSeconds)],
            ["السلسلة", item.seriesName],
            ...sourceRows(item),
          ]}
        />
        <SiblingList title={item.seriesName ? `حلقات أخرى من ${item.seriesName}` : "حلقات في نفس الموضوع"} items={more} />
        </>
      }
    >
      <div className="space-y-10">
      {item.videoId && item.videoProvider === "youtube" ? (
        <div className="aspect-video overflow-hidden rounded-2xl shadow-card border border-border">
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}`}
            title={item.title}
            loading="lazy"
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="space-y-4">
          <VideoThumb title={item.title} thumbnailUrl={item.thumbnailUrl} rounded />
          <p className="text-sm leading-7 text-muted-foreground">لا يتوفر رابط تشغيل مباشر لهذه الحلقة حاليًا.</p>
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
              زيارة مصدر الفيديو <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
        </div>
      )}
      <FactGrid facts={[["تاريخ النشر", formatDateAr(item.publishedAt)], ["المدة", formatDuration(item.durationSeconds)], ["المقدّم", item.authorName], ["السلسلة", item.seriesName]]} />
      <DetailBody item={item} heading="تفاصيل الحلقة" emptyText="لم يُضف ملخص أو نص مكتوب لهذه الحلقة بعد. يمكن لفريق الموقع إضافته من لوحة التحكم." />
      </div>
    </DetailShell>
  );
}
