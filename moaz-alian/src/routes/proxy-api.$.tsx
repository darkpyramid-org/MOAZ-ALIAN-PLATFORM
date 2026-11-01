import { createFileRoute } from "@tanstack/react-router";

const BACKEND = "http://moaz-alian.runasp.net";

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Strip the "/proxy-api" prefix so the backend sees its real path.
  const backendPath = url.pathname.replace(/^\/proxy-api/, "") || "/";
  const target = `${BACKEND}${backendPath}${url.search}`;

  // Forward a curated set of headers; drop hop-by-hop and host.
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") continue;
    headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  let body: BodyInit | undefined;
  if (hasBody) {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: body ?? null,
      // Never follow redirects automatically; pass them through.
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "transfer-encoding" || lower === "connection" || lower === "content-encoding")
        continue;
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[proxy-api] upstream fetch failed", error);
    return new Response(JSON.stringify({ title: "Bad Gateway", status: 502 }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/proxy-api/$")({
  server: {
    handlers: {
      GET: async ({ request }) => proxy(request),
      POST: async ({ request }) => proxy(request),
      PUT: async ({ request }) => proxy(request),
      PATCH: async ({ request }) => proxy(request),
      DELETE: async ({ request }) => proxy(request),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
    },
  },
});
