import { useMatches } from "@tanstack/react-router";
import { defaultSiteSettings, type SiteSettings } from "@/data/site-settings";

export function useSiteSettings(): SiteSettings {
  return useMatches({
    select: (matches) => {
      const root = matches.find((m) => m.routeId === "__root__");
      const data = root?.loaderData as { settings?: SiteSettings } | undefined;
      return data?.settings ?? defaultSiteSettings;
    },
  });
}
