import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";

import { Highlight } from "@/components/content/Highlight";
import { categories } from "@/data/categories";
import { trapFocus, useDismiss, usePresence, useScrollLock } from "@/hooks/use-overlay";
import { normalizeArabic, searchItems } from "@/lib/content";
import { TYPE_LABELS, TYPE_ROUTES, type ContentItem, type ContentType } from "@/types/content";

const SUGGESTIONS = ["مقارنة الأديان", "مريم", "الكتاب المقدس", "المناظرات", "معجزات"];

function hitHref(item: ContentItem) {
  return item.type === "video"
    ? { to: "/videos/$slug", params: { slug: item.slug } }
    : item.type === "book"
      ? { to: "/books/$slug", params: { slug: item.slug } }
      : item.type === "article"
        ? { to: "/articles/$slug", params: { slug: item.slug } }
        : { to: "/research/$slug", params: { slug: item.slug } };
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, visible, state } = usePresence(open, 280);
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setQ("");
  }, [open]);

  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  const hits = useMemo(() => (q.trim() ? searchItems(q).slice(0, 8) : []), [q]);

  const catHits = useMemo(() => {
    const n = normalizeArabic(q);
    return n
      ? categories
          .filter((c) => normalizeArabic(c.name + " " + c.description).includes(n))
          .slice(0, 4)
      : [];
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<ContentType, ContentItem[]>();
    for (const { item } of hits) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return [...map.entries()];
  }, [hits]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 px-3 pt-3 sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="البحث في الموقع"
      onKeyDown={trapFocus(panelRef)}
    >
      <div
        data-state={state}
        className="drawer-backdrop absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        data-state={state}
        className="search-panel relative mx-auto flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-float"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن كتاب أو مقال أو فيديو أو موضوع..."
            aria-label="البحث في الموقع"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="مسح البحث"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق البحث"
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Esc
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-2">
          {!q.trim() && (
            <div className="p-3">
              <p className="text-xs text-muted-foreground">اقتراحات</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQ(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q.trim() && (
            <p className="sr-only" role="status">
              {hits.length === 0 ? "لا توجد نتائج" : `${hits.length} نتيجة`}
            </p>
          )}

          {catHits.length > 0 && (
            <div className="border-b border-border/60 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-primary">التصنيفات</p>
              <div className="flex flex-wrap gap-2">
                {catHits.map((c) => (
                  <Link
                    key={c.id}
                    to="/categories/$id"
                    params={{ id: c.id }}
                    onClick={onClose}
                    className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:border-primary hover:text-primary"
                  >
                    <Highlight text={c.name} query={q} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {q.trim() && hits.length === 0 && catHits.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              لا توجد نتائج مطابقة. جرّب كلمات أقل أو مصطلحًا آخر.
            </p>
          )}

          {groups.map(([type, items]) => (
            <div key={type} className="border-b border-border/60 py-2 last:border-0">
              <p className="px-4 py-1 text-xs font-semibold text-primary">
                {TYPE_LABELS[type]} ({items.length})
              </p>
              <ul>
                {items.map((item) => {
                  const href = hitHref(item);
                  return (
                    <li key={item.id}>
                      <Link
                        to={href.to}
                        params={href.params}
                        onClick={onClose}
                        className="search-hit group mx-1 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-accent"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-6">
                            <Highlight text={item.title} query={q} />
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ArrowLeft
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {q.trim() && (
            <div className="p-3">
              <Link
                to="/search"
                search={{ q }}
                onClick={onClose}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                عرض كل النتائج ({hits.length === 8 ? "٨+" : hits.length})
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
