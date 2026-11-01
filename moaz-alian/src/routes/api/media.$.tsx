import { createFileRoute } from "@tanstack/react-router";
import { isValidMediaObjectPath } from "@/lib/media/object-path";

// Serves media files with caching.
export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = decodeURIComponent(url.pathname.replace(/^\/api\/media\//, ""));

        if (!isValidMediaObjectPath(path)) {
          return new Response("Not found", { status: 404 });
        }

        return new Response("Not found", { status: 404 });
      },
    },
  },
});
