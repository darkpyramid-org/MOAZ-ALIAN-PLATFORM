import { useMemo, useState } from "react";
import { Pagination, SortSelect, ViewToggle, usePaged } from "@/components/dashboard/list-controls";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, deleteCategory, saveCategory } from "@/lib/api";
import { slugify, useAdminCategories, useAdminItems, useRefreshLibrary } from "@/lib/admin-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormActions } from "@/components/dashboard/FormActions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/categories")({
  head: () => ({
    meta: [
      { title: "إدارة التصنيفات — لوحة مكتبة معاذ عليان" },
      { name: "description", content: "إدارة التصنيفات في مكتبة معاذ عليان." },
      { property: "og:title", content: "إدارة التصنيفات — مكتبة معاذ عليان" },
      { property: "og:description", content: "إدارة التصنيفات في لوحة إدارة المكتبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CategoriesPage,
});

type Edit = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isNew: boolean;
};

function CategoriesPage() {
  const { data: cats = [] } = useAdminCategories();
  const { data: items = [] } = useAdminItems();
  const refresh = useRefreshLibrary();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [sort, setSort] = useState("order");
  const [view, setView] = useState<"list" | "grid">("grid");
  const countOf = (id: string) => items.filter((i) => i.categoryIds.includes(id)).length;
  const sorted = useMemo(() => {
    const out = [...cats];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (sort === "count") out.sort((a, b) => countOf(b.id) - countOf(a.id));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, items, sort]);
  const paged = usePaged(sorted, 12, sort);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const id = edit.isNew ? slugify(edit.id || edit.name) : edit.id;
    if (!id || !edit.name.trim()) {
      toast.error("الاسم والمعرّف مطلوبان");
      return;
    }
    try {
      await saveCategory(
        {
          id,
          name: edit.name.trim(),
          description: edit.description.trim(),
          // A new row joins at the end of the display order; an edit keeps its place.
          sortOrder: edit.isNew ? cats.length : edit.sortOrder,
        },
        !edit.isNew,
      );
      toast.success("تم الحفظ");
      setEdit(null);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.isConflict
            ? "المعرّف مستخدم"
            : error.message
          : "تعذّر الحفظ",
      );
    }
  }

  async function remove(id: string, name: string) {
    // The API refuses to delete a category that still has content, so say the
    // same thing here instead of offering a delete that can only fail.
    const used = countOf(id);
    if (used) {
      toast.error(
        `«${name}» مستخدم في ${used.toLocaleString("ar-EG")} مادة — أزل منه المواد أولًا`,
      );
      return;
    }
    if (!confirm(`حذف التصنيف «${name}»؟`)) return;
    try {
      await deleteCategory(id);
      toast.success("تم الحذف");
      refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "تعذّر الحذف");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">التصنيفات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cats.length.toLocaleString("ar-EG")} تصنيف
          </p>
        </div>
        <button
          className="btn-gold"
          onClick={() =>
            setEdit({ id: "", name: "", description: "", sortOrder: cats.length, isNew: true })
          }
        >
          <Plus className="size-4" /> تصنيف جديد
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "order", label: "الترتيب الافتراضي" },
            { value: "name", label: "حسب الاسم" },
            { value: "count", label: "الأكثر مواد" },
          ]}
        />
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div
        className={
          view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2"
        }
      >
        {paged.items.map((c) => (
          <div key={c.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{c.name}</h2>
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs">
                {countOf(c.id).toLocaleString("ar-EG")} مادة
              </span>
            </div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
            <div className="mt-3 flex gap-1">
              <button
                onClick={() =>
                  setEdit({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    sortOrder: c.sort_order,
                    isNew: false,
                  })
                }
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm hover:bg-accent"
              >
                <Pencil className="size-4" /> تعديل
              </button>
              <button
                onClick={() => remove(c.id, c.name)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="size-4" /> حذف
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface empty:hidden">
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          onPage={paged.setPage}
          total={sorted.length}
          unit="تصنيف"
        />
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.isNew ? "تصنيف جديد" : "تعديل التصنيف"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label>الاسم</Label>
                <Input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              {edit.isNew && (
                <div className="space-y-1.5">
                  <Label>المعرّف (بالإنجليزية)</Label>
                  <Input
                    dir="ltr"
                    placeholder="history"
                    value={edit.id}
                    onChange={(e) => setEdit({ ...edit, id: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>الوصف</Label>
                <Textarea
                  rows={3}
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </div>
              <div>
                <FormActions onCancel={() => setEdit(null)} />
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
