import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor";

/** Current signed-in user + their dashboard roles (validated by the auth server). */
export function useStaff() {
  return useQuery({
    queryKey: ["me", "roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return { user: null, roles: [] as AppRole[] };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return { user, roles: (data ?? []).map((r) => r.role as AppRole) };
    },
  });
}
