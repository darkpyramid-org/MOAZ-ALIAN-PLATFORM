import { createFileRoute } from "@tanstack/react-router";
import { isValidMediaObjectPath } from "@/lib/media/object-path";

// Serves images uploaded to the private "media" storage bucket.
// Requests /api/media/media/<path> stream the object with long-lived caching.

const MEDIA_BUCKET = "media";

function storageHeaders(apikey: string): HeadersInit {
  // Publishable key only; bucket reads are gated by a public-read policy.
  return { apikey };
}

export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let path: string;
        try {
          path = decodeURIComponent(url.pathname.replace(/^\/api\/media\//, ""));
        } catch {
          return new Response("Not found", { status: 404 });
        }

        if (!isValidMediaObjectPath(path)) {
          return new Response("Not found", { status: 404 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return new Response("Media service unavailable", { status: 503 });
        }

        // Stored values carry the bucket prefix ("media/<folder>/<file>");
        // the object path inside the bucket drops that prefix.
        const objectPath = path.replace(/^media\//, "");
        const objectUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${MEDIA_BUCKET}/${objectPath
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;

        let upstream: Response;
        try {
          upstream = await fetch(objectUrl, { headers: storageHeaders(publishableKey) });
        } catch {
          return new Response("Media upstream unreachable", { status: 502 });
        }

        if (!upstream.ok || !upstream.body) {
          console.error("[media] upstream not ok:", upstream.status, objectUrl);
          // Treat any storage rejection as "image not found" for browsers.
          return new Response("Not found", { status: 404 });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
            "content-length": upstream.headers.get("content-length") ?? "",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
