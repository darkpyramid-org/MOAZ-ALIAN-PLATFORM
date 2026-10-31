import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormSkeleton } from "@/components/skeletons";

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ExternalLink, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  defaultSiteSettings,
  heroFromSlide,
  pageKeys,
  sectionKeys,
  resolveSiteSettings,
  siteSettingsSchema,
  slideFromHero,
  type HeroSlide,
  type SiteSettings,
} from "@/data/site-settings";
import { ImageUpload } from "@/components/media/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard/pages")({
  head: () => ({
    meta: [
      { title: "الصفحات والبانر — لوحة مكتبة معاذ عليان" },
      { name: "description", content: "إدارة بانر الصفحة الرئيسية وأقسام المكتبة وصفحاتها." },
      { property: "og:title", content: "الصفحات والبانر — مكتبة معاذ عليان" },
      { property: "og:description", content: "إدارة الصفحات ومحتوى البانر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pages,
});
const names = {
  videos: "الفيديوهات",
  books: "الكتب",
  articles: "المقالات",
  research: "الأبحاث",
  categories: "التصنيفات",
};
const sections = {
  featured: "محتوى مميز",
  explore: "أقسام المكتبة",
  video: "الفيديو المميز",
  books: "رفّ الكتب",
  articles: "أحدث المقالات",
  recent: "أُضيف مؤخرًا والموضوعات",
};
function Pages() {
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("data,updated_at")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return { settings: resolveSiteSettings(data?.data), version: data?.updated_at ?? "default" };
    },
  });
  if (query.isPending) return <FormSkeleton fields={6} />;
  if (query.isError)
    return (
      <div role="alert" className="space-y-3">
        <p>تعذّر تحميل الصفحات.</p>
        <Button onClick={() => query.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  return <SettingsForm key={query.data.version} initial={query.data.settings} />;
}
type PagesForm = SiteSettings & { slides: HeroSlide[] };
function withSlides(initial: SiteSettings): PagesForm {
  return {
    ...structuredClone(initial),
    slides: initial.slides?.length
      ? structuredClone(initial.slides)
      : [slideFromHero(initial.hero)],
  };
}
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [form, setForm] = useState<PagesForm>(() => withSlides(initial));
  const [saved, setSaved] = useState<PagesForm>(() => withSlides(initial));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const change = (next: PagesForm) => {
    setForm(next);
    setDirty(true);
  };
  const updateSlide = (i: number, patch: Partial<HeroSlide>) =>
    change({ ...form, slides: form.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSlide = () =>
    change({
      ...form,
      slides: [
        ...form.slides,
        {
          kicker: "",
          title: "",
          intro: "",
          image: "",
          primaryLabel: "",
          primaryHref: "",
          secondaryLabel: "",
          secondaryHref: "",
          links: [],
        },
      ],
    });
  const removeSlide = (i: number) =>
    change({ ...form, slides: form.slides.filter((_, j) => j !== i) });
  const moveSlide = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.slides.length) return;
    const next = [...form.slides];
    [next[i], next[j]] = [next[j]!, next[i]!];
    change({ ...form, slides: next });
  };
  const about = (key: keyof SiteSettings["about"], value: string) =>
    change({ ...form, about: { ...form.about, [key]: value } });
  async function save(e: FormEvent) {
    e.preventDefault();
    const slides = form.slides.length > 0 ? form.slides : [slideFromHero(form.hero)];
    const first = slides[0] ?? slideFromHero(form.hero);
    const toSave: SiteSettings = {
      ...form,
      slides,
      hero: { ...heroFromSlide(first, form.hero.search) },
    };
    const parsed = siteSettingsSchema.safeParse(toSave);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "راجع الحقول");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ id: "main", data: parsed.data as unknown as Json });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["library"] });
      await router.invalidate();
      setSaved(structuredClone(parsed.data) as PagesForm);
      setDirty(false);
      toast.success("تم حفظ الصفحات والبانر");
    } catch {
      toast.error("تعذّر الحفظ. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">الصفحات والبانر</h1>
        <Button asChild variant="outline">
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink />
            عرض الموقع
          </a>
        </Button>
      </div>
      <Tabs defaultValue="banner" dir="rtl">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="banner">البانر</TabsTrigger>
          <TabsTrigger value="home">أقسام الرئيسية</TabsTrigger>
          <TabsTrigger value="pages">صفحات المكتبة</TabsTrigger>
          <TabsTrigger value="about">عن المكتبة</TabsTrigger>
        </TabsList>
        <TabsContent value="banner" className="space-y-5 pt-4">
          <p className="text-sm text-muted-foreground">
            تظهر الشرائح كشريحة متحركة أعلى الصفحة الرئيسية بالترتيب أدناه، ويمكنك إضافة شرائح جديدة
            أو حذفها أو إعادة ترتيبها.
          </p>
          {form.slides.map((s, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  الشريحة {i + 1}
                  {i === 0 ? " — البانر الحالي" : ""}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={i === 0}
                    aria-label="نقل لأعلى"
                    onClick={() => moveSlide(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={i === form.slides.length - 1}
                    aria-label="نقل لأسفل"
                    onClick={() => moveSlide(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={form.slides.length === 1}
                    aria-label="حذف الشريحة"
                    onClick={() => removeSlide(i)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <Field id={`slide-${i}-kicker`} label="النص العلوي">
                    <Input
                      id={`slide-${i}-kicker`}
                      maxLength={120}
                      value={s.kicker}
                      onChange={(e) => updateSlide(i, { kicker: e.target.value })}
                    />
                  </Field>
                  <Field id={`slide-${i}-title`} label="عنوان الشريحة">
                    <Input
                      id={`slide-${i}-title`}
                      required
                      maxLength={160}
                      value={s.title}
                      onChange={(e) => updateSlide(i, { title: e.target.value })}
                    />
                  </Field>
                  <Field id={`slide-${i}-intro`} label="الوصف">
                    <Textarea
                      id={`slide-${i}-intro`}
                      maxLength={1200}
                      rows={4}
                      value={s.intro}
                      onChange={(e) => updateSlide(i, { intro: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="min-w-0">
                  <ImageUpload
                    value={s.image}
                    onChange={(v) => updateSlide(i, { image: v ?? "" })}
                    folder="banner"
                    aspect="16/10"
                    previewAlt={`صورة الشريحة ${i + 1}`}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field id={`slide-${i}-primary`} label="الزر الأساسي">
                  <Input
                    id={`slide-${i}-primary`}
                    maxLength={80}
                    value={s.primaryLabel}
                    onChange={(e) => updateSlide(i, { primaryLabel: e.target.value })}
                  />
                </Field>
                <Field id={`slide-${i}-primary-href`} label="رابط الزر الأساسي">
                  <Input
                    id={`slide-${i}-primary-href`}
                    dir="ltr"
                    placeholder="/categories أو https://"
                    value={s.primaryHref}
                    onChange={(e) => updateSlide(i, { primaryHref: e.target.value })}
                  />
                </Field>
                <Field id={`slide-${i}-secondary`} label="الزر الثاني">
                  <Input
                    id={`slide-${i}-secondary`}
                    maxLength={80}
                    value={s.secondaryLabel}
                    onChange={(e) => updateSlide(i, { secondaryLabel: e.target.value })}
                  />
                </Field>
                <Field id={`slide-${i}-secondary-href`} label="رابط الزر الثاني">
                  <Input
                    id={`slide-${i}-secondary-href`}
                    dir="ltr"
                    placeholder="/videos أو https://"
                    value={s.secondaryHref}
                    onChange={(e) => updateSlide(i, { secondaryHref: e.target.value })}
                  />
                </Field>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <Label>روابط الشريحة (سوشيال، جدول الموسم…)</Label>
                {s.links.map((l, li) => (
                  <div key={li} className="flex gap-2">
                    <Input
                      aria-label="اسم الرابط"
                      placeholder="اسم الرابط، مثل: واتساب"
                      maxLength={80}
                      value={l.label}
                      onChange={(e) =>
                        updateSlide(i, {
                          links: s.links.map((x, k) =>
                            k === li ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Input
                      dir="ltr"
                      aria-label="رابط"
                      placeholder="https://…"
                      value={l.href}
                      onChange={(e) =>
                        updateSlide(i, {
                          links: s.links.map((x, k) =>
                            k === li ? { ...x, href: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="حذف الرابط"
                      onClick={() => updateSlide(i, { links: s.links.filter((_, k) => k !== li) })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateSlide(i, { links: [...s.links, { label: "", href: "" }] })}
                >
                  <Plus />
                  إضافة رابط
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addSlide}>
            <Plus />
            إضافة شريحة جديدة
          </Button>
          <div className="flex items-center justify-between border-y border-border py-4">
            <Label htmlFor="hero-search-enabled">البحث في أول شريحة</Label>
            <Switch
              id="hero-search-enabled"
              checked={form.hero.search}
              onCheckedChange={(v) => change({ ...form, hero: { ...form.hero, search: v } })}
            />
          </div>
        </TabsContent>
        <TabsContent value="home" className="space-y-4 pt-4">
          {sectionKeys.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between border-b border-border py-4"
            >
              <Label htmlFor={`section-${key}`}>{sections[key]}</Label>
              <Switch
                id={`section-${key}`}
                checked={form.sections[key]}
                onCheckedChange={(v) =>
                  change({ ...form, sections: { ...form.sections, [key]: v } })
                }
              />
            </div>
          ))}
          <Button asChild variant="outline">
            <Link to="/dashboard/content" search={{ type: "video" }}>
              إدارة المحتوى المميز
            </Link>
          </Button>
        </TabsContent>
        <TabsContent value="pages" className="space-y-8 pt-4">
          {pageKeys.map((key) => (
            <section key={key} className="space-y-4 border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{names[key]}</h2>
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={`/${key}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`عرض ${names[key]}`}
                  >
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              {(["kicker", "title", "intro"] as const).map((field) => (
                <Field
                  key={field}
                  id={`${key}-${field}`}
                  label={
                    field === "kicker" ? "النص العلوي" : field === "title" ? "العنوان" : "الوصف"
                  }
                >
                  {field === "intro" ? (
                    <Textarea
                      id={`${key}-${field}`}
                      maxLength={1200}
                      value={form.pages[key][field]}
                      onChange={(e) =>
                        change({
                          ...form,
                          pages: {
                            ...form.pages,
                            [key]: { ...form.pages[key], [field]: e.target.value },
                          },
                        })
                      }
                    />
                  ) : (
                    <Input
                      id={`${key}-${field}`}
                      maxLength={field === "title" ? 160 : 120}
                      value={form.pages[key][field]}
                      onChange={(e) =>
                        change({
                          ...form,
                          pages: {
                            ...form.pages,
                            [key]: { ...form.pages[key], [field]: e.target.value },
                          },
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </section>
          ))}
        </TabsContent>
        <TabsContent value="about" className="space-y-4 pt-4">
          {(["kicker", "title", "intro", "image", "imageAlt", "teaser", "body"] as const).map(
            (key) => (
              <Field
                key={key}
                id={`about-${key}`}
                label={
                  {
                    kicker: "النص العلوي",
                    title: "العنوان",
                    intro: "الوصف",
                    image: "صورة صفحة عن المكتبة",
                    imageAlt: "وصف الصورة",
                    teaser: "نبذة الصفحة الرئيسية",
                    body: "المحتوى الكامل",
                  }[key]
                }
              >
                {key === "image" ? (
                  <ImageUpload
                    value={form.about.image}
                    onChange={(v) => about("image", v ?? "")}
                    folder="about"
                    aspect="21/9"
                    previewAlt="صورة صفحة عن المكتبة"
                  />
                ) : ["body", "intro", "teaser"].includes(key) ? (
                  <Textarea
                    id={`about-${key}`}
                    rows={key === "body" ? 12 : 3}
                    value={form.about[key]}
                    onChange={(e) => about(key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={`about-${key}`}
                    value={form.about[key]}
                    onChange={(e) => about(key, e.target.value)}
                  />
                )}
              </Field>
            ),
          )}
        </TabsContent>
      </Tabs>
      <div className="sticky bottom-0 bg-background pb-2 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !dirty} className="btn-gold">
            <Save />
            {busy ? "جارٍ الحفظ…" : "حفظ التعديلات"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn-outline"
            disabled={busy || !dirty}
            onClick={() => {
              setForm(structuredClone(saved));
              setDirty(false);
            }}
          >
            <RotateCcw />
            إلغاء التعديلات
          </Button>
          {dirty && <span className="text-sm text-muted-foreground">تعديلات غير محفوظة</span>}
        </div>
      </div>
    </form>
  );
}
