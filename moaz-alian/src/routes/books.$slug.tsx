import { ErrorScreen, MissingItemScreen } from "@/components/feedback/StatusScreens";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { DetailBody, DetailShell, FactGrid, MetaList, SiblingList, TocNav, detailHead, siblings, sourceRows } from "@/components/content/Detail";
import { BookCover } from "@/components/content/cards";
import { itemBySlug } from "@/lib/content";
import type { BookItem } from "@/types/content";

const AVAIL = { digital: "نسخة رقمية", print: "مطبوع", unknown: "غير محدد" } as const;

export const Route = createFileRoute("/books/$slug")({
  loader: ({ params }) => {
    const item = itemBySlug("book", params.slug) as BookItem | undefined;
    if (!item) throw notFound();
    return { item };
  },
  head: ({ loaderData }) => detailHead(loaderData?.item, "الكتاب"),
  component: Page,
  notFoundComponent: () => <MissingItemScreen label="الكتاب" listTo="/books" listLabel="الكتب" />,
  errorComponent: ErrorScreen,
});

function Page() {
  const { item } = Route.useLoaderData();
  const byAuthor = item.authorName ? siblings(item, (it) => it.authorName === item.authorName) : [];
  return (
    <DetailShell
      item={item}
      aside={
        <>
        <TocNav body={item.body} label="محتويات الصفحة" />
        <MetaList
          rows={[
            ["المؤلف", item.authorName],
            ["الناشر", item.publisher],
            ["سنة النشر", item.publicationYear],
            ["ISBN", item.isbn],
            ["التوفر", AVAIL[item.availability]],
            ...sourceRows(item),
          ]}
        />
        <SiblingList title={`كتب أخرى لـ ${item.authorName ?? "المؤلف"}`} items={byAuthor} />
        </>
      }
    >
      <div className="space-y-10">
      <div className="grid gap-8 sm:grid-cols-[14rem_1fr]">
        <div className="max-w-56">
          <BookCover book={item} className="rounded-2xl border shadow-card" />
        </div>
        <div>
          <h2 className="mb-2 font-semibold">روابط القراءة</h2>
          {item.authorizedLinks.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              {item.authorizedLinks.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-gold w-fit text-sm">
                  {l.label} <ExternalLink className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {item.availability === "digital"
                ? "لم تُضف روابط قراءة مؤكدة لهذا الكتاب بعد."
                : "لا تتوفر نسخة رقمية من هذا الكتاب حاليًا."}
            </p>
          )}
        </div>
      </div>
      <FactGrid facts={[["المؤلف", item.authorName], ["الناشر", item.publisher], ["سنة النشر", item.publicationYear], ["ISBN", item.isbn], ["التوفر", AVAIL[item.availability]]]} />
      <DetailBody item={item} heading="عن الكتاب" emptyText="لم يُضف تعريف مفصّل أو فهرس لهذا الكتاب بعد. يمكن لفريق الموقع إضافته من لوحة التحكم." />
      </div>
    </DetailShell>
  );
}
