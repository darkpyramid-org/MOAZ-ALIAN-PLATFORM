import { FilterSelect } from "./FilterSelect";
import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { RotateCcw, Search, X } from "lucide-react";

import { ContentCard } from "@/components/content/cards";
import { EmptyState, Pagination } from "@/components/content/ui";
import { categories, categoryById } from "@/data/categories";
import { applyListing, seriesNames, type ListingSearch, type SortKey } from "@/lib/listing";
import type { ContentItem } from "@/types/content";

const PAGE_SIZE = 9;
export const RETURN_KEY = "return-to-results";

export function PageHero({ kicker, title, intro }: { kicker: string; title: string; intro: string }) {
  return (
    <section className="hero-band">
      <div className="container-editorial py-10 md:py-14">
        <p className="animate-rise mb-2 text-xs font-semibold tracking-wide text-primary">{kicker}</p>
        <h1 className="animate-rise-1 text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
        <span className="gold-rule mt-5 block" aria-hidden />
        <p className="animate-rise-2 mt-5 max-w-2xl leading-8 text-muted-foreground">{intro}</p>
      </div>
    </section>
  );
}

const SORT_LABELS: Record<SortKey, string> = { new: "الأحدث أولًا", old: "الأقدم أولًا", title: "حسب العنوان" };

export function Listing({
  items,
  search,
  onChange,
  grid = "md:grid-cols-3",
  hideCategory = false,
}: {
  items: ContentItem[];
  search: ListingSearch;
  onChange: (next: ListingSearch) => void;
  grid?: string;
  hideCategory?: boolean;
}) {
  const href = useRouterState({ select: (s) => s.location.href });
  const [ownPath] = useState(() => href.split("?")[0]);
  const [draft, setDraft] = useState(search.q ?? "");

  // Remember this exact results view so detail pages can link back to it.
  useEffect(() => {
    // Skip the transitional render where the URL already points at the next page.
    if (href.split("?")[0] !== ownPath) return;
    try {
      sessionStorage.setItem(RETURN_KEY, href);
    } catch {
      /* storage unavailable */
    }
  }, [href, ownPath]);

  // Debounce typing into the URL.
  useEffect(() => {
    if ((search.q ?? "") === draft) return;
    const t = setTimeout(() => onChange({ ...search, q: draft || undefined, page: undefined }), 250);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setDraft(search.q ?? ""), [search.q]);

  const usedCats = useMemo(
    () => categories.filter((c) => items.some((it) => it.categoryIds.includes(c.id))),
    [items],
  );
  const series = useMemo(() => seriesNames(items), [items]);
  const filtered = useMemo(() => applyListing(items, search), [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(search.page ?? 1, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const set = (patch: ListingSearch) => onChange({ ...search, ...patch, page: patch.page });

  const chips: { label: string; clear: ListingSearch }[] = [];
  if (search.q) chips.push({ label: `«${search.q}»`, clear: { q: undefined } });
  if (search.cat) chips.push({ label: categoryById(search.cat)?.name ?? search.cat, clear: { cat: undefined } });
  if (search.series) chips.push({ label: search.series, clear: { series: undefined } });
  const anyFilter = chips.length > 0 || !!search.sort;

  return (
    <div className="container-editorial section-y-sm">
      <div className="mb-4 grid grid-cols-2 gap-3 md:flex md:items-center">
        <label className="relative col-span-2 flex-1">
          <span className="sr-only">ابحث في هذا القسم</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ابحث بالعنوان أو الوصف…"
            className="field w-full py-2.5 ps-10 pe-4 text-sm"
          />
        </label>
        {!hideCategory && usedCats.length > 1 && (
          <FilterSelect
            label="التصنيف"
            allLabel="كل التصنيفات"
            value={search.cat}
            onChange={(v) => set({ cat: v })}
            options={usedCats.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        {series.length > 0 && (
          <FilterSelect
            label="السلسلة"
            allLabel="كل السلاسل"
            value={search.series}
            onChange={(v) => set({ series: v })}
            options={series.map((x) => ({ value: x, label: x }))}
          />
        )}
        <FilterSelect
          label="الترتيب"
          value={search.sort ?? "new"}
          onChange={(v) => set({ sort: !v || v === "new" ? undefined : (v as SortKey) })}
          options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
          disabled={!!search.q}
          title={search.q ? "النتائج مرتبة حسب الصلة بالبحث" : undefined}
        />
      </div>

      <div className="mb-6 flex min-h-8 flex-wrap items-center gap-2">
        <p className="me-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {filtered.length} نتيجة
        </p>
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => set(c.clear)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs text-foreground transition-colors hover:border-primary"
          >
            {c.label}
            <X className="size-3" aria-hidden />
            <span className="sr-only">إزالة عامل التصفية</span>
          </button>
        ))}
        {anyFilter && (
          <button type="button" onClick={() => onChange({})} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <RotateCcw className="size-3" aria-hidden />
            إعادة الضبط
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="لا توجد نتائج مطابقة"
          hint="جرّب كلمات أخرى أو أزل عوامل التصفية."
          action={anyFilter ? <button type="button" className="btn-outline text-sm" onClick={() => onChange({})}>إعادة ضبط الفلاتر</button> : undefined}
        />
      ) : (
        <div key={`${page}-${filtered.length}`} className={`animate-rise grid gap-6 sm:grid-cols-2 ${grid}`}>
          {visible.map((it) => (
            <ContentCard key={it.id} item={it} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          set({ page: p > 1 ? p : undefined });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
