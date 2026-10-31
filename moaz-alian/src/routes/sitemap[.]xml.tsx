import { createFileRoute } from "@tanstack/react-router";

import { categories } from "@/data/categories";
import { allItems } from "@/lib/content";
import { TYPE_ROUTES } from "@/types/content";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths = [
          "/", "/videos", "/books", "/articles", "/research", "/categories", "/about", "/search",
          ...categories.map((c) => `/categories/${c.id}`),
          ...allItems.filter((i) => !i.demo).map((i) => `${TYPE_ROUTES[i.type]}/${i.slug}`),
        ];
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          paths.map((p) => `  <url><loc>${origin}${encodeURI(p)}</loc></url>`).join("\n") +
          `\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
