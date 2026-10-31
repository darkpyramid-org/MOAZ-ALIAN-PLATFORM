import { useSiteSettings } from "@/hooks/use-site-settings";
import { createFileRoute } from "@tanstack/react-router";

import { Listing, PageHero } from "@/components/content/Listing";

import { itemsByType } from "@/lib/content";
import { parseListingSearch } from "@/lib/listing";

export const Route = createFileRoute("/videos/")({
  validateSearch: parseListingSearch,
  head: () => ({
    links: [{ rel: "canonical", href: "/videos" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "الفيديوهات — معاذ عليان" },
      { name: "description", content: "حلقات وحوارات مسجّلة في مقارنة الأديان والرد على الشبهات، مع روابط مشاهدتها في مصادرها الأصلية." },
      { property: "og:title", content: "الفيديوهات — معاذ عليان" },
      { property: "og:description", content: "حلقات وحوارات مسجّلة في مقارنة الأديان والرد على الشبهات، مع روابط مشاهدتها في مصادرها الأصلية." },
    ],
  }),
  component: Page,
});

function Page() {
  const page = useSiteSettings().pages.videos;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHero kicker={page.kicker} title={page.title} intro={page.intro} />
      
      <Listing
        items={itemsByType("video")}
        search={search}
        onChange={(next) => navigate({ search: next, replace: true, resetScroll: false })}
        grid="md:grid-cols-3"
      />
    </>
  );
}
