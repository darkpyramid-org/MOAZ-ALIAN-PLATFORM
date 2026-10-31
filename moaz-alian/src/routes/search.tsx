import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";


import { ContentCard } from "@/components/content/cards";
import { PageHero, RETURN_KEY } from "@/components/content/Listing";
import { EmptyState } from "@/components/content/ui";
import { searchItems } from "@/lib/content";
import { TYPE_LABELS, type ContentType } from "@/types/content";

type Search = { q?: string | undefined };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "/search" }],
    meta: [
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "البحث — معاذ عليان" },
      { name: "description", content: "ابحث في فيديوهات وكتب ومقالات وأبحاث معاذ عليان ببحث عربي يتجاوز اختلاف الهمزات والتشكيل." },
      { property: "og:title", content: "البحث — معاذ عليان" },
      { property: "og:description", content: "بحث عربي ذكي في المكتبة كاملة." },
    ],
  }),
  component: Page,
});

function Page() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [draft, setDraft] = useState(q);
  const [type, setType] = useState<ContentType | "all">("all");

  useEffect(() => {
    setDraft(q);
    try {
      sessionStorage.setItem(RETURN_KEY, `/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    } catch {
      /* storage unavailable */
    }
  }, [q]);

  const hits = useMemo(() => searchItems(q).map((h) => h.item), [q]);
  const shown = type === "all" ? hits : hits.filter((h) => h.type === type);

  return (
    <>
      <PageHero kicker="بحث" title={q ? `نتائج «${q}»` : "ابحث في المكتبة"} intro="البحث يتجاهل التشكيل واختلاف الهمزات والتاء المربوطة." />
      <div className="container-editorial section-y-sm">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: draft.trim() || undefined } });
          }}
          className="relative mb-6"
        >
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="اكتب كلمة أو عنوانًا…"
            aria-label="كلمة البحث"
            className="field w-full py-3.5 ps-12 pe-28"
          />
          <button type="submit" className="btn-gold absolute end-1.5 top-1/2 -translate-y-1/2 text-sm">بحث</button>
        </form>
        {q && (
          <div className="mb-6 flex flex-wrap gap-2">
            {(["all", "video", "book", "article", "research"] as const).map((t) => {
              const n = t === "all" ? hits.length : hits.filter((h) => h.type === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`rounded-full border px-4 py-1.5 text-sm ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "all" ? "الكل" : TYPE_LABELS[t]} ({n})
                </button>
              );
            })}
          </div>
        )}
        {q && (
          <p role="status" aria-live="polite" className="sr-only">
            {shown.length > 0 ? `${shown.length} نتيجة` : "لا توجد نتائج"}
          </p>
        )}
        {!q ? (
          <EmptyState title="ابدأ بكتابة كلمة للبحث" hint="مثال: مريم، المناظرات، الكتاب المقدس." />
        ) : shown.length === 0 ? (
          <EmptyState title="لا توجد نتائج" hint="جرّب كلمة أقصر أو مرادفًا آخر." />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {shown.map((it) => (
              <ContentCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
