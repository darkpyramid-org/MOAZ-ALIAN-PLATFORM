import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import type { Category, ContentItem } from "@/types/content";
import { resolveSiteSettings } from "@/data/site-settings";
import { createSupabaseFetch } from "@/lib/supabase-fetch";

/** Public read of the whole library (content + categories). */
export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: createSupabaseFetch(key) },
  });
  const [items, cats, settings] = await Promise.all([
    sb.from("content_items").select("data"),
    sb.from("categories").select("id,name,description").order("sort_order"),
    sb.from("site_settings").select("data").eq("id", "main").maybeSingle(),
  ]);
  return {
    items: (items.data ?? []).map((r) => r.data as unknown as ContentItem),
    categories: (cats.data ?? []) as Category[],
    settings: resolveSiteSettings(settings.data?.data),
  };
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
  staleTime: 60_000,
});
