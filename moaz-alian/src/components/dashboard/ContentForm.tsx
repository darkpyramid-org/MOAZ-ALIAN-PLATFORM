import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify, useAdminCategories } from "@/lib/admin-data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldSelect } from "@/components/ui/field-select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormActions } from "@/components/dashboard/FormActions";
import { ImageUpload } from "@/components/media/ImageUpload";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  TYPE_LABELS,
  type ContentItem,
  type ContentType,
  type RightsStatus,
} from "@/types/content";

type Form = Record<string, string | boolean | string[]>;

export function toForm(type: ContentType, it?: ContentItem): Form {
  const a = (it ?? {}) as Record<string, unknown>;
  const s = (k: string) => (a[k] == null ? "" : String(a[k]));
  return {
    title: s("title"),
    slug: s("slug"),
    description: s("description"),
    authorName: it ? s("authorName") : "معاذ عليان",
    thumbnailUrl: s("thumbnailUrl"),
    publishedAt: s("publishedAt"),
    sourceUrl: s("sourceUrl"),
    tags: ((a["tags"] as string[]) ?? []).join("، "),
    categoryIds: (a["categoryIds"] as string[]) ?? [],
    featured: !!a["featured"],
    verified: !!a["verified"],
    demo: !!a["demo"],
    rightsStatus: s("rightsStatus") || "external",
    videoId: s("videoId"),
    durationSeconds: s("durationSeconds"),
    seriesName: s("seriesName"),
    coverUrl: s("coverUrl"),
    publisher: s("publisher"),
    isbn: s("isbn"),
    publicationYear: s("publicationYear"),
    availability: s("availability") || "unknown",
    authorizedLinks: ((a["authorizedLinks"] as { label: string; url: string }[]) ?? [])
      .map((l) => `${l.label} | ${l.url}`)
      .join("\n"),
    body: s("body"),
    readingTimeMinutes: s("readingTimeMinutes"),
    documentUrl: s("documentUrl"),
    documentFormat: s("documentFormat"),
    references: ((a["references"] as string[]) ?? []).join("\n"),
    _type: type,
  };
}

const nul = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) =>
  typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null;
const lines = (v: unknown) =>
  String(v ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function toItem(type: ContentType, f: Form, id: string, initial?: ContentItem): ContentItem {
  const base = {
    ...initial,
    id,
    type,
    slug: slugify(String(f["slug"] || f["title"])),
    title: String(f["title"]).trim(),
    description: String(f["description"]).trim(),
    thumbnailUrl: nul(f["thumbnailUrl"]),
    authorName: nul(f["authorName"]),
    categoryIds: f["categoryIds"] as string[],
    tags: String(f["tags"])
      .split(/[،,]/)
      .map((t) => t.trim())
      .filter(Boolean),
    publishedAt: nul(f["publishedAt"]),
    sourceUrl: nul(f["sourceUrl"]),
    featured: !!f["featured"],
    verified: !!f["verified"],
    demo: !!f["demo"],
    rightsStatus: f["rightsStatus"] as RightsStatus,
    body: nul(f["body"]),
  };
  switch (type) {
    case "video": {
      const vid = nul(f["videoId"]);
      return {
        ...base,
        type,
        videoId: vid,
        videoProvider: vid ? "youtube" : null,
        durationSeconds: num(f["durationSeconds"]),
        seriesName: nul(f["seriesName"]),
      };
    }
    case "book":
      return {
        ...base,
        type,
        coverUrl: nul(f["coverUrl"]),
        publisher: nul(f["publisher"]),
        isbn: nul(f["isbn"]),
        publicationYear: num(f["publicationYear"]),
        availability: f["availability"] as "digital" | "print" | "unknown",
        authorizedLinks: lines(f["authorizedLinks"]).map((l) => {
          const [label, url] = l.split("|").map((x) => x.trim());
          return { label: url ? (label ?? "") : "رابط", url: url ?? label ?? "" };
        }),
      };
    case "article":
      return {
        ...base,
        type,
        body: nul(f["body"]),
        readingTimeMinutes: num(f["readingTimeMinutes"]),
      };
    case "research":
      return {
        ...base,
        type,
        references: lines(f["references"]),
        documentUrl: nul(f["documentUrl"]),
        documentFormat: nul(f["documentFormat"]),
      };
  }
}

export function ContentForm({
  type,
  initial,
  onClose,
  onSaved,
}: {
  type: ContentType;
  initial?: ContentItem | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Form>(() => toForm(type, initial));
  const [busy, setBusy] = useState(false);
  const { data: cats = [] } = useAdminCategories();
  const set = (k: string, v: string | boolean | string[]) => setF((p) => ({ ...p, [k]: v }));
  const txt = (k: string) => ({
    value: String(f[k] ?? ""),
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!String(f["title"]).trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    setBusy(true);
    const id = initial?.id ?? `${type[0]}-${crypto.randomUUID().slice(0, 8)}`;
    const item = toItem(type, f, id, initial);
    if (!item.slug) item.slug = id;
    const { error } = await supabase
      .from("content_items")
      .upsert({ id, type, slug: item.slug, data: item as never });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "الرابط المختصر مستخدم من قبل" : error.message);
      return;
    }
    toast.success(initial ? "تم حفظ التعديلات" : "تمت الإضافة");
    onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {initial ? "تعديل" : "إضافة"} {TYPE_LABELS[type]}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={save} className="space-y-4 px-4 pb-6">
          <F label="العنوان *">
            <Input required {...txt("title")} />
          </F>
          <F label="الرابط المختصر (slug)" hint="يُولّد من العنوان إن تُرك فارغًا">
            <Input dir="ltr" {...txt("slug")} />
          </F>
          <F label="الوصف">
            <Textarea rows={3} {...txt("description")} />
          </F>
          {type !== "article" && (
            <F
              label={
                type === "video"
                  ? "تفاصيل الحلقة / النص الكامل"
                  : type === "book"
                    ? "عن الكتاب / النص الكامل"
                    : "نص البحث الكامل"
              }
            >
              <Textarea rows={10} {...txt("body")} />
            </F>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="المؤلف">
              <Input {...txt("authorName")} />
            </F>
            <F label="تاريخ النشر">
              <DatePicker
                aria-label="تاريخ النشر"
                value={String(f["publishedAt"] ?? "")}
                onChange={(value) => set("publishedAt", value)}
              />
            </F>
          </div>
          <F label="التصنيفات">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const on = (f["categoryIds"] as string[]).includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={(checked) =>
                        set(
                          "categoryIds",
                          checked === true
                            ? [...(f["categoryIds"] as string[]), c.id]
                            : (f["categoryIds"] as string[]).filter((x) => x !== c.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
          </F>
          <F label="الوسوم" hint="افصل بينها بفاصلة">
            <Input {...txt("tags")} />
          </F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="رابط المصدر">
              <Input dir="ltr" type="url" {...txt("sourceUrl")} />
            </F>
            <F label="صورة المادة">
              <ImageUpload
                value={String(f["thumbnailUrl"] ?? "")}
                onChange={(v) => set("thumbnailUrl", v ?? "")}
                folder="content"
                aspect="16/9"
                previewAlt="معاينة صورة المادة"
              />
            </F>
          </div>

          {type === "video" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="معرّف يوتيوب">
                <Input dir="ltr" {...txt("videoId")} />
              </F>
              <F label="المدة (ثوانٍ)">
                <Input type="number" dir="ltr" {...txt("durationSeconds")} />
              </F>
              <F label="السلسلة">
                <Input {...txt("seriesName")} />
              </F>
            </div>
          )}
          {type === "book" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="الناشر">
                  <Input {...txt("publisher")} />
                </F>
                <F label="سنة النشر">
                  <Input type="number" dir="ltr" {...txt("publicationYear")} />
                </F>
                <F label="ISBN">
                  <Input dir="ltr" {...txt("isbn")} />
                </F>
                <F label="التوفّر">
                  <FieldSelect
                    aria-label="التوفّر"
                    dir="rtl"
                    value={String(f["availability"])}
                    onChange={(value) => set("availability", value)}
                    options={[
                      { value: "digital", label: "رقمي" },
                      { value: "print", label: "مطبوع" },
                      { value: "unknown", label: "غير معروف" },
                    ]}
                  />
                </F>
              </div>
              <F label="رابط الغلاف">
                <Input dir="ltr" type="url" {...txt("coverUrl")} />
              </F>
              <F label="روابط مرخّصة" hint="سطر لكل رابط: الاسم | الرابط">
                <Textarea rows={3} {...txt("authorizedLinks")} />
              </F>
            </>
          )}
          {type === "article" && (
            <>
              <F label="مدة القراءة (دقائق)">
                <Input type="number" dir="ltr" {...txt("readingTimeMinutes")} />
              </F>
              <F label="نص المقال" hint="اتركه فارغًا إن كان المقال خارجيًا">
                <Textarea rows={10} {...txt("body")} />
              </F>
            </>
          )}
          {type === "research" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="رابط الملف">
                  <Input dir="ltr" type="url" {...txt("documentUrl")} />
                </F>
                <F label="صيغة الملف">
                  <Input dir="ltr" placeholder="PDF" {...txt("documentFormat")} />
                </F>
              </div>
              <F label="المراجع" hint="سطر لكل مرجع">
                <Textarea rows={4} {...txt("references")} />
              </F>
            </>
          )}

          <F label="حالة الحقوق">
            <FieldSelect
              aria-label="حالة الحقوق"
              dir="rtl"
              value={String(f["rightsStatus"])}
              onChange={(value) => set("rightsStatus", value)}
              options={[
                { value: "owned", label: "مملوك" },
                { value: "licensed", label: "مرخّص" },
                { value: "external", label: "خارجي" },
                { value: "unknown", label: "غير معروف" },
              ]}
            />
          </F>
          <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
            <Toggle label="مميّز" checked={!!f["featured"]} onChange={(v) => set("featured", v)} />
            <Toggle label="موثّق" checked={!!f["verified"]} onChange={(v) => set("verified", v)} />
            <Toggle label="تجريبي" checked={!!f["demo"]} onChange={(v) => set("demo", v)} />
          </div>

          <div className="sticky bottom-0 -mx-6 bg-background px-6 pb-4 pt-4">
            <FormActions onCancel={onClose} busy={busy} />
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
