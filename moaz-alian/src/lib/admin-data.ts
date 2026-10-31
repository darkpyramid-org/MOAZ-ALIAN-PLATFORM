import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Category, ContentItem } from "@/types/content";

export function useAdminItems() {
  return useQuery({
    queryKey: ["admin", "items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_items").select("data, updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.data as unknown as ContentItem);
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,description,sort_order").order("sort_order");
      if (error) throw error;
      return (data ?? []) as (Category & { sort_order: number })[];
    },
  });
}

/** Refresh dashboard data and the public site after a change. */
export function useRefreshLibrary() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await qc.invalidateQueries({ queryKey: ["admin"] });
    await qc.invalidateQueries({ queryKey: ["library"] });
    router.invalidate();
  };
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
