import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { resolveSiteSettings } from "@/data/site-settings";
import { fetchCategories, fetchLibraryItems } from "@/lib/api";

/**
 * Public read of the whole library. Content and categories come from the ASP.NET API —
 * the single source of truth.
 */
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const [items, cats] = await Promise.all([fetchLibraryItems(), fetchCategories()]);

  return {
    items,
    categories: cats.map(({ id, name, description }) => ({ id, name, description })),
    settings: resolveSiteSettings(undefined),
  };
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
  staleTime: 60_000,
});
