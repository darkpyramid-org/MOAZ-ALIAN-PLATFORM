import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorScreen, NotFoundScreen } from "@/components/feedback/StatusScreens";
import { RoutePendingSkeleton } from "@/components/skeletons";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorScreen,
    defaultNotFoundComponent: () => <NotFoundScreen />,
    defaultPendingComponent: RoutePendingSkeleton,
  });

  return router;
};
