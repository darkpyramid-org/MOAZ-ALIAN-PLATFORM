import { useSiteSettings } from "@/hooks/use-site-settings";
import { createFileRoute } from "@tanstack/react-router";

import { Listing, PageHero } from "@/components/content/Listing";
import { FeaturedArticle } from "@/components/content/Featured";
import { itemsByType } from "@/lib/content";
import { parseListingSearch } from "@/lib/listing";

export const Route = createFileRoute("/articles/")({
  validateSearch: parseListingSearch,
  head: () => ({
    links: [{ rel: "canonical", href: "/articles" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "المقالات — معاذ عليان" },
      { name: "description", content: "مقالات وشروح مكتوبة بتجربة قراءة عربية مريحة." },
      { property: "og:title", content: "المقالات — معاذ عليان" },
      { property: "og:description", content: "مقالات وشروح مكتوبة بتجربة قراءة عربية مريحة." },
    ],
  }),
  component: Page,
});

function Page() {
  const page = useSiteSettings().pages.articles;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHero kicker={page.kicker} title={page.title} intro={page.intro} />
      {!search.q && !search.cat && !search.page && <FeaturedArticle />}
      <Listing
        items={itemsByType("article")}
        search={search}
        onChange={(next) => navigate({ search: next, replace: true, resetScroll: false })}
        grid="md:grid-cols-3"
      />
    </>
  );
}
