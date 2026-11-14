import { useQuery } from "@tanstack/react-query";
import { authClient, type AppRole } from "@/lib/auth";

export type { AppRole };

/** Current signed-in user + their dashboard roles (validated by the ASP.NET API). */
export function useStaff() {
  return useQuery({
    queryKey: ["me", "roles"],
    queryFn: async () => {
      const user = await authClient.getMe();
      if (!user) return { user: null, roles: [] as AppRole[] };
      return { user, roles: user.roles };
    },
  });
}
