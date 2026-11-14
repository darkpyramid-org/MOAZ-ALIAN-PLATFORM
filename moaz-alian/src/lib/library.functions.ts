import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { resolveSiteSettings } from "@/data/site-settings";
import { fetchCategories, fetchLibraryItems } from "@/lib/api";

const isServer = typeof window === "undefined";
const RAW_BASE =
  (typeof process !== "undefined" ? process.env["API_URL"] : undefined) ??
  (isServer
    ? import.meta.env.DEV
      ? "http://localhost:5199"
      : "http://moaz-alian.runasp.net"
    : (import.meta.env["VITE_API_URL"] ??
      (import.meta.env.DEV ? "http://localhost:5199" : "/proxy-api")));
const BASE = RAW_BASE.replace(/\/+$/, "");

/**
 * Public read of the whole library. Content and categories come from the ASP.NET API —
 * the single source of truth. Site settings are now also read from the API (the
 * `/api/settings/main` record) instead of always resolving to defaults, so the
 * public site reflects what the dashboard saves (fixes the settings-disconnect bug).
 */
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const [items, cats, settingsRes] = await Promise.all([
    fetchLibraryItems(),
    fetchCategories(),
    fetch(`${BASE}/api/settings/main`).catch(() => null),
  ]);

  let settings = resolveSiteSettings(undefined);
  if (settingsRes && settingsRes.ok) {
    try {
      const json = (await settingsRes.json()) as { data?: unknown };
      settings = resolveSiteSettings(json.data);
    } catch {
      // Fall back to defaults on a malformed body.
    }
  }

  return {
    items,
    categories: cats.map(({ id, name, description }) => ({ id, name, description })),
    settings,
  };
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
  staleTime: 60_000,
});
