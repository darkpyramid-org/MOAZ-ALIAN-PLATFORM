import { ErrorScreen, MissingItemScreen } from "@/components/feedback/StatusScreens";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { ContentCard } from "@/components/content/cards";
import { Listing, PageHero } from "@/components/content/Listing";
import { categoryById } from "@/data/categories";
import { categoriesWithCounts, itemsByCategory } from "@/lib/content";
import { parseListingSearch } from "@/lib/listing";

export const Route = createFileRoute("/categories/$id")({
  validateSearch: parseListingSearch,
  loader: ({ params }) => {
    const category = categoryById(params.id);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.category;
    if (!c) return { meta: [{ title: "تصنيف غير موجود" }, { name: "robots", content: "noindex" }] };
    return {
      links: [{ rel: "canonical", href: `/categories/${c.id}` }],
      meta: [
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { title: `${c.name} — معاذ عليان` },
        { name: "description", content: c.description },
        { property: "og:title", content: `${c.name} — معاذ عليان` },
        { property: "og:description", content: c.description },
      ],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <MissingItemScreen label="التصنيف" listTo="/categories" listLabel="التصنيفات" />
  ),
  errorComponent: ErrorScreen,
});

function Page() {
  const { category } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const items = itemsByCategory(category.id);
  const featured = items.find((i) => i.featured) ?? items[0];

  // Related = categories that share the most items with this one.
  const related = categoriesWithCounts()
    .filter((c) => c.id !== category.id)
    .map((c) => ({ ...c, shared: items.filter((i) => i.categoryIds.includes(c.id)).length }))
    .sort((a, b) => b.shared - a.shared || b.count - a.count)
    .slice(0, 4);

  const filtering = !!(search.q || search.page || search.series || search.sort);

  return (
    <>
      <PageHero kicker="تصنيف" title={category.name} intro={category.description} />
      {featured && !filtering && (
        <section className="container-editorial pt-10">
          <p className="mb-4 text-xs font-semibold tracking-wide text-primary">
            مادة مميزة في هذا التصنيف
          </p>
          <div className="max-w-md">
            <ContentCard item={featured} />
          </div>
        </section>
      )}
      <Listing
        key={category.id}
        items={items}
        search={search}
        hideCategory
        onChange={(next) => navigate({ search: next, replace: true, resetScroll: false })}
      />
      <section className="border-t border-border">
        <div className="container-editorial section-y-sm">
          <h2 className="mb-4 text-lg font-semibold">تصنيفات ذات صلة</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((c) => (
              <Link
                key={c.id}
                to="/categories/$id"
                params={{ id: c.id }}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {c.name} <span className="text-xs">({c.count})</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
