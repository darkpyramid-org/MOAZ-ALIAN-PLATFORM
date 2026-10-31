import { Link } from "@tanstack/react-router";

import { categories } from "@/data/categories";

const EXTERNAL = [
  { label: "قناة يوتيوب", href: "https://www.youtube.com/channel/UCZgb3h-QHvK8abuJzs73vag" },
  { label: "إسلام لاند — صفحة المؤلف", href: "https://www.islamland.com/ose/authors/731" },
  { label: "فهرس الحلقات (تنوير)", href: "https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/" },
  { label: "Clubhouse", href: "https://www.clubhouse.com/@moazalian" },
  { label: "Patreon", href: "https://www.patreon.com/moazalian/about" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-deep">
      <div className="container-editorial grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8 xl:gap-12">
        <div className="sm:col-span-2 lg:pe-8">
          <p className="text-lg font-bold">معاذ عليان — فضاء معرفي</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            منصة مستقلة لجمع المواد المنشورة والمتاحة للعموم في مجال مقارنة الأديان
            والقضايا الفكرية: الفيديوهات والكتب والمقالات والأبحاث، مع إحالة كل مادة
            إلى مصدرها.
          </p>
          <p className="mt-4 max-w-md text-xs leading-6 text-muted-foreground">
            هذا الموقع غير تابع رسميًا لمعاذ عليان ولا يمثله، وجميع الروابط الخارجية
            تُبقي المحتوى عند مصدره الأصلي.
          </p>
        </div>

        <nav aria-label="روابط الموقع">
          <p className="text-sm font-semibold text-foreground">روابط الموقع</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/videos" className="hover:text-primary">الفيديوهات</Link></li>
            <li><Link to="/books" className="hover:text-primary">الكتب</Link></li>
            <li><Link to="/articles" className="hover:text-primary">المقالات</Link></li>
            <li><Link to="/research" className="hover:text-primary">الأبحاث</Link></li>
            <li><Link to="/about" className="hover:text-primary">عن معاذ عليان</Link></li>
          </ul>
        </nav>

        <nav aria-label="التصنيفات">
          <p className="text-sm font-semibold text-foreground">التصنيفات</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {categories.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to="/categories/$id" params={{ id: c.id }} className="hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="منصات خارجية">
          <p className="text-sm font-semibold text-foreground">منصات خارجية</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground sm:grid sm:grid-cols-2 sm:gap-x-10 sm:space-y-0">
            {EXTERNAL.map((x) => (
              <li key={x.href}>
                <a href={x.href} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                  {x.label}
                  <span className="sr-only"> (يفتح في نافذة جديدة)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="container-editorial flex flex-col items-center gap-1 py-5 text-center text-xs text-muted-foreground md:flex-row md:justify-between md:text-start">
          <span>© 2026 فضاء معرفي مستقل. جميع المواد تبقى ملك أصحابها.</span>
          <a href="/dashboard" className="hover:text-primary">دخول الفريق</a>
          <span className="font-latin">Made with care — independent knowledge archive</span>
        </div>
      </div>
    </footer>
  );
}
