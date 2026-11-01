import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { fetchCategories, fetchLibraryItems } from "@/lib/api";
import type { Category } from "@/types/content";

export function useAdminItems() {
  return useQuery({
    queryKey: ["admin", "items"],
    queryFn: fetchLibraryItems,
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: fetchCategories,
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

export type AdminCategory = Category & { sort_order: number };
