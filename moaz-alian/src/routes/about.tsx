import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { PageHero } from "@/components/content/Listing";
import { ArticleBody } from "@/components/content/Detail";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { libraryQuery } from "@/lib/library.functions";
import { ContentPageSkeleton } from "@/components/skeletons";
import { mediaUrl } from "@/lib/media";

export const Route = createFileRoute("/about")({
  loader: ({ context }) => context.queryClient.ensureQueryData(libraryQuery),
  head: ({ loaderData }) => ({
    links: [{ rel: "canonical", href: "/about" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.settings.about.image.startsWith("https://")
        ? [
            { property: "og:image", content: loaderData.settings.about.image },
            { name: "twitter:image", content: loaderData.settings.about.image },
          ]
        : []),
      { title: "عن معاذ عليان — المكتبة المعرفية" },
      {
        name: "description",
        content:
          "تعريف بمعاذ عليان ومجالات عمله في مقارنة الأديان، وبفكرة هذه المكتبة المستقلة ومصادرها.",
      },
      { property: "og:title", content: "عن معاذ عليان" },
      { property: "og:description", content: "تعريف بمجالات العمل وبفكرة هذه المكتبة المستقلة." },
    ],
  }),
  component: Page,
  pendingComponent: ContentPageSkeleton,
});

const LINKS = [
  { label: "قناة يوتيوب", href: "https://www.youtube.com/channel/UCZgb3h-QHvK8abuJzs73vag" },
  { label: "صفحة المؤلف على إسلام لاند", href: "https://www.islamland.com/ose/authors/731" },
  {
    label: "فهرس الحلقات على تنوير",
    href: "https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/",
  },
  { label: "Clubhouse", href: "https://www.clubhouse.com/@moazalian" },
  { label: "Patreon", href: "https://www.patreon.com/moazalian/about" },
];

function Page() {
  const { about } = useSiteSettings();
  return (
    <>
      <PageHero kicker={about.kicker} title={about.title} intro={about.intro} />
      <div className="container-editorial pt-10">
        <img
          src={mediaUrl(about.image, "/images/about-cover.webp")}
          alt={about.imageAlt}
          width={960}
          height={504}
          loading="lazy"
          className="aspect-[21/9] w-full rounded-lg border border-border object-cover"
        />
      </div>
      <div className="container-editorial grid gap-10 section-y-sm lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <ArticleBody body={about.body} />
        <aside className="rounded-lg border border-border bg-surface p-6 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-4 font-semibold">المصادر العامة</p>
          <ul className="space-y-3 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-primary"
                >
                  {l.label} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
