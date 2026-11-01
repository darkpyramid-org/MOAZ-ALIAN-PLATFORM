import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { resolveSiteSettings } from "@/data/site-settings";
import { createSupabaseFetch } from "@/lib/supabase-fetch";
import { fetchCategories, fetchLibraryItems } from "@/lib/api";

/**
 * Public read of the whole library. Content and categories come from the API —
 * the single source of truth — while site settings stay in Supabase, because
 * that table is the admin's key/value store and has no API counterpart.
 */
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  const url = process.env["SUPABASE_URL"];

  let settingsData: unknown = undefined;
  if (url && key) {
    try {
      const sb = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        global: { fetch: createSupabaseFetch(key) },
      });
      const r = await sb
        .from("site_settings")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      settingsData = r.data?.data;
    } catch {
      // Site settings fallback to built-in defaults
    }
  }

  const [items, cats] = await Promise.all([
    fetchLibraryItems(),
    fetchCategories(),
  ]);

  return {
    items,
    categories: cats.map(({ id, name, description }) => ({ id, name, description })),
    settings: resolveSiteSettings(settingsData),
  };
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
  staleTime: 60_000,
});
