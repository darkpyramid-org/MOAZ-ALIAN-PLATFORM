import { useSiteSettings } from "@/hooks/use-site-settings";
import { createFileRoute } from "@tanstack/react-router";

import { Listing, PageHero } from "@/components/content/Listing";

import { itemsByType } from "@/lib/content";
import { parseListingSearch } from "@/lib/listing";

export const Route = createFileRoute("/books/")({
  validateSearch: parseListingSearch,
  head: () => ({
    links: [{ rel: "canonical", href: "/books" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "الكتب — معاذ عليان" },
      {
        name: "description",
        content: "كتب ومؤلفات منشورة، مع روابط القراءة المتاحة من مصادر معتمدة.",
      },
      { property: "og:title", content: "الكتب — معاذ عليان" },
      {
        property: "og:description",
        content: "كتب ومؤلفات منشورة، مع روابط القراءة المتاحة من مصادر معتمدة.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const page = useSiteSettings().pages.books;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHero kicker={page.kicker} title={page.title} intro={page.intro} />

      <Listing
        items={itemsByType("book")}
        search={search}
        onChange={(next) => navigate({ search: next, replace: true, resetScroll: false })}
        grid="md:grid-cols-4 lg:grid-cols-5"
      />
    </>
  );
}
