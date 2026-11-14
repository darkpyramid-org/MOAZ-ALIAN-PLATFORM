import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldSelect } from "@/components/ui/field-select";
import { FormActions } from "@/components/dashboard/FormActions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowsSkeleton } from "@/components/skeletons";
import { Pagination, SortSelect, usePaged } from "@/components/dashboard/list-controls";
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

export const Route = createFileRoute("/_authenticated/dashboard/debates")({
  head: () => ({
    meta: [
      { title: "سجل المحاورين — لوحة مكتبة معاذ عليان" },
      { name: "description", content: "جدول المحاورين وموضوعات الحوار وملخص الردود." },
      { property: "og:title", content: "سجل المحاورين — مكتبة معاذ عليان" },
      { property: "og:description", content: "جدول المحاورين وموضوعات الحوار وملخص الردود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DebatesPage,
});

const OUTCOMES: Record<string, string> = {
  open: "لم يُحسم",
  convinced: "اقتنع / أسلم",
  considering: "يفكّر",
  rejected: "رفض",
};

type Row = {
  id?: string;
  guest_name: string;
  guest_background: string | null;
  topic: string;
  reply_summary: string | null;
  outcome: string;
  debate_date: string | null;
  video_url: string | null;
  tags: string[];
  notes: string | null;
};

const EMPTY: Row = {
  guest_name: "",
  guest_background: "",
  topic: "",
  reply_summary: "",
  outcome: "open",
  debate_date: "",
  video_url: "",
  tags: [],
  notes: "",
};
const KEY = ["admin", "debates"];

const isServer = typeof window === "undefined";
const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ??
  (isServer
    ? import.meta.env.DEV
      ? "http://localhost:5199"
      : "http://moaz-alian.runasp.net"
    : (import.meta.env["VITE_API_URL"] ??
      (import.meta.env.DEV ? "http://localhost:5199" : "/proxy-api")));
const BASE = RAW_BASE.replace(/\/+$/, "");

function DebatesPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const token = authClient.getAccessToken();
      const res = await fetch(`${BASE}/api/debates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("تعذر جلب سجل المحاورين");
      return (await res.json()) as (Row & { id: string })[];
    },
  });
  const [edit, setEdit] = useState<Row | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [sort, setSort] = useState("newest");
  const [toDelete, setToDelete] = useState<(Row & { id: string }) | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim();
    const out = rows.filter(
      (r) =>
        (outcome === "all" || r.outcome === outcome) &&
        (!s ||
          [r.guest_name, r.topic, r.reply_summary, r.guest_background, r.tags.join(" ")].some((v) =>
            v?.includes(s),
          )),
    );
    const d = (r: Row) => r.debate_date ?? "";
    return [...out].sort((a, b) =>
      sort === "name"
        ? a.guest_name.localeCompare(b.guest_name, "ar")
        : sort === "oldest"
          ? d(a).localeCompare(d(b))
          : d(b).localeCompare(d(a)),
    );
  }, [rows, q, outcome, sort]);
  const paged = usePaged(filtered, 10, `${q}|${outcome}|${sort}`);

  function open(r: Row) {
    setEdit({ ...r });
    setTagsText(r.tags.join("، "));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    if (!edit.guest_name.trim() || !edit.topic.trim()) {
      toast.error("اسم المحاور والموضوع مطلوبان");
      return;
    }
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const row = {
      guest_name: edit.guest_name.trim(),
      guest_background: clean(edit.guest_background),
      topic: edit.topic.trim(),
      reply_summary: clean(edit.reply_summary),
      outcome: edit.outcome,
      debate_date: clean(edit.debate_date),
      video_url: clean(edit.video_url),
      tags: tagsText
        .split(/[,،]/)
        .map((t) => t.trim())
        .filter(Boolean),
      notes: clean(edit.notes),
    };
    const token = authClient.getAccessToken();
    const res = await fetch(edit.id ? `${BASE}/api/debates/${edit.id}` : `${BASE}/api/debates`, {
      method: edit.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      toast.error("تعذر حفظ المحاورة");
      return;
    }
    toast.success("تم الحفظ");
    setEdit(null);
    qc.invalidateQueries({ queryKey: KEY });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const token = authClient.getAccessToken();
    const res = await fetch(`${BASE}/api/debates/${toDelete.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast.error("تعذر الحذف");
      return;
    }
    toast.success("تم الحذف");
    setToDelete(null);
    qc.invalidateQueries({ queryKey: KEY });
  }

  const set = (k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    edit && setEdit({ ...edit, [k]: e.target.value });
  const outcomeOptions = Object.entries(OUTCOMES).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">سجل المحاورين</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length.toLocaleString("ar-EG")} حوار مسجّل
          </p>
        </div>
        <button className="btn-gold" onClick={() => open(EMPTY)}>
          <Plus className="size-4" /> حوار جديد
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="ابحث بالاسم أو الموضوع أو الرد…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <FieldSelect
          className="w-auto min-w-40"
          value={outcome}
          onChange={setOutcome}
          options={[{ value: "all", label: "كل النتائج" }, ...outcomeOptions]}
        />
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "newest", label: "الأحدث أولًا" },
            { value: "oldest", label: "الأقدم أولًا" },
            { value: "name", label: "حسب اسم المحاور" },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>المحاور</TableHead>
              <TableHead>الموضوع</TableHead>
              <TableHead className="min-w-72">ملخص الرد</TableHead>
              <TableHead>النتيجة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRowsSkeleton />}
            {paged.items.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell>
                  <div className="font-semibold">{r.guest_name}</div>
                  {r.guest_background && (
                    <div className="text-xs text-muted-foreground">{r.guest_background}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{r.topic}</div>
                  {r.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-pre-line text-sm text-muted-foreground">
                  <p className="line-clamp-3">{r.reply_summary || "—"}</p>
                </TableCell>
                <TableCell>
                  <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs">
                    {OUTCOMES[r.outcome] ?? r.outcome}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.debate_date ? new Date(r.debate_date).toLocaleDateString("ar-EG") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {r.video_url && (
                      <a
                        href={r.video_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="فتح الفيديو"
                        className="rounded-full p-1.5 hover:bg-accent"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <button
                      aria-label="تعديل"
                      onClick={() => open(r)}
                      className="rounded-full p-1.5 hover:bg-accent"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="حذف"
                      onClick={() => setToDelete(r)}
                      className="rounded-full p-1.5 text-destructive hover:bg-accent"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && filtered.length === 0 && (
          <div className="border-t py-10 text-center text-sm text-muted-foreground">
            {rows.length ? "لا نتائج مطابقة" : "لا توجد حوارات بعد — أضف أول حوار"}
          </div>
        )}
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          onPage={paged.setPage}
          total={filtered.length}
          unit="حوار"
        />
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحوار مع «{toDelete?.guest_name}»؟</AlertDialogTitle>
            <AlertDialogDescription>سيُحذف هذا الحوار نهائيًا.</AlertDialogDescription>
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

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "تعديل الحوار" : "حوار جديد"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>اسم المحاور</Label>
                <Input required value={edit.guest_name} onChange={set("guest_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>خلفيته (الديانة / البلد / الصفة)</Label>
                <Input
                  value={edit.guest_background ?? ""}
                  onChange={set("guest_background")}
                  placeholder="مثال: مسيحي — مصر"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>موضوع الحوار</Label>
                <Input required value={edit.topic} onChange={set("topic")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ملخص الرد</Label>
                <Textarea
                  rows={5}
                  value={edit.reply_summary ?? ""}
                  onChange={set("reply_summary")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>النتيجة</Label>
                <FieldSelect
                  aria-label="النتيجة"
                  dir="rtl"
                  value={edit.outcome}
                  onChange={(v) => edit && setEdit({ ...edit, outcome: v })}
                  options={outcomeOptions}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="debate-date">تاريخ الحوار</Label>
                <DatePicker
                  id="debate-date"
                  value={edit.debate_date}
                  onChange={(value) => setEdit({ ...edit, debate_date: value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>رابط الفيديو</Label>
                <Input
                  dir="ltr"
                  type="url"
                  placeholder="https://youtube.com/…"
                  value={edit.video_url ?? ""}
                  onChange={set("video_url")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>وسوم (افصل بفاصلة)</Label>
                <Input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="التثليث، الصلب"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ملاحظات داخلية</Label>
                <Textarea rows={2} value={edit.notes ?? ""} onChange={set("notes")} />
              </div>
              <div className="sm:col-span-2">
                <FormActions onCancel={() => setEdit(null)} />
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
