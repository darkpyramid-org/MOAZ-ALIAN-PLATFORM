import { useSiteSettings } from "@/hooks/use-site-settings";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHero } from "@/components/content/Listing";
import { categoriesWithCounts } from "@/lib/content";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    links: [{ rel: "canonical", href: "/categories" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "التصنيفات — معاذ عليان" },
      {
        name: "description",
        content:
          "تصفّح مواد معاذ عليان حسب الموضوع: مقارنة الأديان، المسيحية، الشبهات والردود، المناظرات وغيرها.",
      },
      { property: "og:title", content: "التصنيفات — معاذ عليان" },
      { property: "og:description", content: "تصفّح المكتبة حسب الموضوع." },
    ],
  }),
  component: Page,
});

function Page() {
  const page = useSiteSettings().pages.categories;
  const cats = categoriesWithCounts();
  return (
    <>
      <PageHero kicker={page.kicker} title={page.title} intro={page.intro} />
      <div className="container-editorial grid gap-5 section-y-sm sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Link
            key={c.id}
            to="/categories/$id"
            params={{ id: c.id }}
            className="card-lift rounded-lg border border-border bg-surface p-6"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <span className="text-sm text-primary">{c.count}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{c.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
