import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, FileText, FlaskConical, FolderTree, Plus, Star, Video } from "lucide-react";
import { useAdminCategories, useAdminItems } from "@/lib/admin-data";
import { TYPE_LABELS, type ContentType } from "@/types/content";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [
    { title: "نظرة عامة — لوحة مكتبة معاذ عليان" },
    { name: "description", content: "نظرة عامة في مكتبة معاذ عليان." },
    { property: "og:title", content: "نظرة عامة — مكتبة معاذ عليان" },
    { property: "og:description", content: "نظرة عامة في لوحة إدارة المكتبة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Overview,
});

const CARDS: { type: ContentType; label: string; icon: typeof Video }[] = [
  { type: "video", label: "فيديو", icon: Video },
  { type: "book", label: "كتاب", icon: BookOpen },
  { type: "article", label: "مقال", icon: FileText },
  { type: "research", label: "بحث", icon: FlaskConical },
];

function Overview() {
  const { data: items = [] } = useAdminItems();
  const { data: cats = [] } = useAdminCategories();
  const featured = items.filter((i) => i.featured).length;
  const demo = items.filter((i) => i.demo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">نظرة عامة</h1>
          <p className="mt-1 text-sm text-muted-foreground">ملخص محتوى المكتبة.</p>
        </div>
        <Link to="/dashboard/content" search={{ type: "video", new: true }} className="btn-gold">
          <Plus className="size-4" /> إضافة محتوى
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link key={c.type} to="/dashboard/content" search={{ type: c.type }}
            className="group rounded-2xl border border-border bg-surface p-4 transition hover:border-primary sm:p-5">
            <c.icon className="size-5 text-primary" />
            <div className="mt-3 text-3xl font-bold">{items.filter((i) => i.type === c.type).length.toLocaleString("ar-EG")}</div>
            <div className="text-sm text-muted-foreground">{TYPE_LABELS[c.type]}</div>
          </Link>
        ))}
      </div>

      <Link to="/dashboard/pages" className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-5 hover:border-primary">
        <span className="font-semibold">الصفحات والبانر</span><span className="text-sm text-primary">تعديل</span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={FolderTree} label="التصنيفات" value={cats.length} />
        <Stat icon={Star} label="مواد مميّزة" value={featured} />
        <Stat icon={FileText} label="مواد تجريبية تحتاج استبدال" value={demo} />
      </div>

      <section className="rounded-2xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold sm:px-5">آخر التعديلات</h2>
        <ul className="divide-y divide-border">
          {items.slice(0, 6).map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs">{TYPE_LABELS[i.type]}</span>
              <span className="min-w-0 flex-1 truncate">{i.title}</span>
              <Link to="/dashboard/content" search={{ type: i.type, edit: i.id }} className="shrink-0 text-sm text-primary hover:underline">تعديل</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Video; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-accent"><Icon className="size-5 text-primary" /></span>
      <div>
        <div className="text-xl font-bold">{value.toLocaleString("ar-EG")}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
