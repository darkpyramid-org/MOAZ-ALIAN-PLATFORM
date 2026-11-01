import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { ErrorScreen, NotFoundScreen, OfflineBanner } from "@/components/feedback/StatusScreens";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BackToTop } from "@/components/layout/BackToTop";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Toaster } from "@/components/ui/sonner";
import { THEME_BOOT_SCRIPT } from "@/components/layout/ThemeToggle";
import { libraryQuery } from "@/lib/library.functions";
import { hydrateLibrary } from "@/lib/content";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return <NotFoundScreen />;
}

function ErrorComponent(props: ErrorComponentProps) {
  return <ErrorScreen {...props} full boundary="tanstack_root_error_component" />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#101820" },
      { title: "معاذ عليان — مكتبة معرفية في مقارنة الأديان" },
      {
        name: "description",
        content:
          "مكتبة عربية مستقلة تجمع فيديوهات وكتب ومقالات وأبحاث معاذ عليان في مقارنة الأديان.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  loader: async ({ context }) => {
    try {
      const data = await context.queryClient.ensureQueryData(libraryQuery);
      hydrateLibrary(data);
      return data;
    } catch (error) {
      // The API is the only copy of the corpus, so a failure here renders an empty
      // library. Loud on purpose: pages must not quietly look healthy on stale data.
      console.error("[library] failed to load the library from the API", error);
      return undefined;
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const library = Route.useLoaderData();
  hydrateLibrary(library);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isApp =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/reset-password");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  if (isApp) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="bottom-center" />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 btn-gold"
      >
        تخطَّ إلى المحتوى
      </a>
      <Header />
      <main id="main" className="min-h-[70vh]">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <ChatWidget />
      <OfflineBanner />
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}
