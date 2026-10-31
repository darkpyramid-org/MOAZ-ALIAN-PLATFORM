import { useSiteSettings } from "@/hooks/use-site-settings";
import { createFileRoute } from "@tanstack/react-router";

import { Listing, PageHero } from "@/components/content/Listing";

import { itemsByType } from "@/lib/content";
import { parseListingSearch } from "@/lib/listing";

export const Route = createFileRoute("/research/")({
  validateSearch: parseListingSearch,
  head: () => ({
    links: [{ rel: "canonical", href: "/research" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "الأبحاث — معاذ عليان" },
      { name: "description", content: "أوراق بحثية ومجموعات مراجع في النصوص الدينية ومقارنة الأديان." },
      { property: "og:title", content: "الأبحاث — معاذ عليان" },
      { property: "og:description", content: "أوراق بحثية ومجموعات مراجع في النصوص الدينية ومقارنة الأديان." },
    ],
  }),
  component: Page,
});

function Page() {
  const page = useSiteSettings().pages.research;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHero kicker={page.kicker} title={page.title} intro={page.intro} />
      
      <Listing
        items={itemsByType("research")}
        search={search}
        onChange={(next) => navigate({ search: next, replace: true, resetScroll: false })}
        grid="md:grid-cols-3"
      />
    </>
  );
}
