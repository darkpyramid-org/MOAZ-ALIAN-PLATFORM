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
      : (process.env["API_URL"] ?? "http://localhost:5199")
    : (import.meta.env["VITE_API_URL"] ??
      (import.meta.env.DEV ? "http://localhost:5199" : "/proxy-api")));
const BASE = RAW_BASE.replace(/\/+$/, "");

/**
 * Public read of the whole library. Content and categories come from the API.
 * Resilient to backend cold starts / database errors so SSR and client hydration
 * never throw an unhandled 500 into ErrorBoundary.
 */
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [items, cats, settingsRes] = await Promise.all([
      fetchLibraryItems().catch((err) => {
        console.warn("[library] fetchLibraryItems failed:", err);
        return [];
      }),
      fetchCategories().catch((err) => {
        console.warn("[library] fetchCategories failed:", err);
        return [];
      }),
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
      items: items ?? [],
      categories: (cats ?? []).map(({ id, name, description }) => ({ id, name, description })),
      settings,
    };
  } catch (error) {
    console.error("[library] getLibrary server function failed:", error);
    return {
      items: [],
      categories: [],
      settings: resolveSiteSettings(undefined),
    };
  }
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
  staleTime: 60_000,
});
