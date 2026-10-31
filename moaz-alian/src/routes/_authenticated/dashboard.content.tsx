import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminItems, useRefreshLibrary } from "@/lib/admin-data";
import { ContentForm } from "@/components/dashboard/ContentForm";
import { Input } from "@/components/ui/input";
import { RowsSkeleton } from "@/components/skeletons";
import {
  FilterChip,
  Pagination,
  SortSelect,
  ViewToggle,
  usePaged,
} from "@/components/dashboard/list-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TYPE_LABELS, type ContentItem, type ContentType } from "@/types/content";
import { normalizeArabic } from "@/lib/content";

type S = { type: ContentType; edit?: string | undefined; new?: boolean | undefined };
const TYPES: ContentType[] = ["video", "book", "article", "research"];

export const Route = createFileRoute("/_authenticated/dashboard/content")({
  validateSearch: (s: Record<string, unknown>): S => ({
    type: TYPES.includes(s["type"] as ContentType) ? (s["type"] as ContentType) : "video",
    edit: typeof s["edit"] === "string" ? s["edit"] : undefined,
    new: s["new"] === true || s["new"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "إدارة المحتوى — لوحة مكتبة معاذ عليان" },
      { name: "description", content: "إدارة المحتوى في مكتبة معاذ عليان." },
      { property: "og:title", content: "إدارة المحتوى — مكتبة معاذ عليان" },
      { property: "og:description", content: "إدارة المحتوى في لوحة إدارة المكتبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContentPage,
});

const PLURAL: Record<ContentType, string> = {
  video: "الفيديوهات",
  book: "الكتب",
  article: "المقالات",
  research: "الأبحاث",
};

function ContentPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: items = [], isLoading } = useAdminItems();
  const refresh = useRefreshLibrary();
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<ContentItem | null>(null);
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [onlyDemo, setOnlyDemo] = useState(false);

  const list = useMemo(() => {
    const nq = normalizeArabic(q);
    const out = items.filter(
      (i) =>
        i.type === search.type &&
        (!nq || normalizeArabic(i.title).includes(nq)) &&
        (!onlyFeatured || i.featured) &&
        (!onlyDemo || i.demo),
    );
    const date = (i: ContentItem) => i.publishedAt ?? "";
    return [...out].sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ar")
        : sort === "oldest"
          ? date(a).localeCompare(date(b))
          : date(b).localeCompare(date(a)),
    );
  }, [items, search.type, q, sort, onlyFeatured, onlyDemo]);
  const paged = usePaged(list, 10, `${search.type}|${q}|${sort}|${onlyFeatured}|${onlyDemo}`);

  const editing = search.edit ? items.find((i) => i.id === search.edit) : undefined;
  const formOpen = !!search.new || !!editing;
  const closeForm = () => navigate({ search: { type: search.type } });

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("content_items").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    setToDelete(null);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{PLURAL[search.type]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length.toLocaleString("ar-EG")} مادة
          </p>
        </div>
        <button
          className="btn-gold"
          onClick={() => navigate({ search: { type: search.type, new: true } })}
        >
          <Plus className="size-4" /> إضافة {TYPE_LABELS[search.type]}
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => navigate({ search: { type: t } })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${t === search.type ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {PLURAL[t]}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالعنوان…"
            className="ps-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={onlyFeatured} onClick={() => setOnlyFeatured((v) => !v)}>
          المميّزة فقط
        </FilterChip>
        <FilterChip active={onlyDemo} onClick={() => setOnlyDemo((v) => !v)}>
          التجريبية فقط
        </FilterChip>
        <div className="ms-auto flex items-center gap-2">
          <SortSelect
            value={sort}
            onChange={setSort}
            options={[
              { value: "newest", label: "الأحدث أولًا" },
              { value: "oldest", label: "الأقدم أولًا" },
              { value: "title", label: "حسب العنوان" },
            ]}
          />
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {isLoading ? (
          <RowsSkeleton />
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">لا توجد مواد.</p>
        ) : (
          <ul
            className={
              view === "grid"
                ? "grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3"
                : "divide-y divide-border"
            }
          >
            {paged.items.map((i) => (
              <li
                key={i.id}
                className={
                  view === "grid"
                    ? "flex flex-col gap-3 rounded-xl border border-border p-4"
                    : "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {i.featured && (
                      <Star
                        className="size-4 shrink-0 fill-primary text-primary"
                        aria-label="مميّز"
                      />
                    )}
                    <span className="truncate font-medium">{i.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{i.publishedAt ?? "بدون تاريخ"}</span>
                    {i.demo && <span className="text-primary">تجريبي</span>}
                    <span dir="ltr">/{i.slug}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => navigate({ search: { type: search.type, edit: i.id } })}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm hover:bg-accent"
                  >
                    <Pencil className="size-4" /> تعديل
                  </button>
                  <button
                    onClick={() => setToDelete(i)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-destructive hover:bg-accent"
                  >
                    <Trash2 className="size-4" /> حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          onPage={paged.setPage}
          total={list.length}
        />
      </div>

      {formOpen && (
        <ContentForm
          key={editing?.id ?? "new-" + search.type}
          type={search.type}
          initial={editing}
          onClose={closeForm}
          onSaved={() => {
            refresh();
            closeForm();
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{toDelete?.title}»؟</AlertDialogTitle>
            <AlertDialogDescription>سيُزال من الموقع نهائيًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
