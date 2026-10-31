import { ErrorScreen, MissingItemScreen } from "@/components/feedback/StatusScreens";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Download } from "lucide-react";

import {
  DetailBody,
  DetailShell,
  FactGrid,
  MetaList,
  SiblingList,
  TocNav,
  detailHead,
  siblings,
  sourceRows,
} from "@/components/content/Detail";
import { ContentImage } from "@/components/content/cards";
import { formatDateAr, itemBySlug } from "@/lib/content";
import type { ResearchItem } from "@/types/content";

export const Route = createFileRoute("/research/$slug")({
  loader: ({ params }) => {
    const item = itemBySlug("research", params.slug) as ResearchItem | undefined;
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => detailHead(loaderData?.item, "البحث"),
  component: Page,
  notFoundComponent: () => (
    <MissingItemScreen label="البحث" listTo="/research" listLabel="الأبحاث" />
  ),
  errorComponent: ErrorScreen,
});

function Page() {
  const { item } = Route.useLoaderData();
  return (
    <DetailShell
      item={item}
      aside={
        <>
          <TocNav body={item.body} label="محتويات البحث" />
          <MetaList
            rows={[
              ["الباحث", item.authorName],
              ["الصيغة", item.documentFormat],
              ["عدد المراجع", item.references.length || null],
              ...sourceRows(item),
            ]}
          />
          <SiblingList title="أبحاث أخرى" items={siblings(item, () => true)} />
        </>
      }
    >
      <div className="space-y-10">
        {item.thumbnailUrl && (
          <ContentImage
            src={item.thumbnailUrl}
            fallback="/images/research-cover.webp"
            title={item.title}
            rounded
          />
        )}
        {item.documentUrl ? (
          <a
            href={item.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold text-sm"
          >
            تحميل الوثيقة <Download className="size-4" aria-hidden />
          </a>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            لم يُضف ملف كامل لهذا البحث بعد.
          </p>
        )}
        <FactGrid
          facts={[
            ["الباحث", item.authorName],
            ["تاريخ النشر", formatDateAr(item.publishedAt)],
            ["الصيغة", item.documentFormat],
            ["عدد المراجع", item.references.length || null],
          ]}
        />
        <DetailBody
          item={item}
          heading="نص البحث"
          emptyText="لم يُضف النص الكامل أو الملخص التفصيلي لهذا البحث بعد. يمكن لفريق الموقع إضافته من لوحة التحكم."
        />
        <section>
          <h2 className="mb-3 text-xl font-bold">المراجع</h2>
          {item.references.length ? (
            <ol className="list-decimal space-y-2 ps-5 text-sm leading-7">
              {item.references.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">لم تُضف مراجع لهذا السجل بعد.</p>
          )}
        </section>
      </div>
    </DetailShell>
  );
}
