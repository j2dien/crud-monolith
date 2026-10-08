import {
  act,
  render,
} from "@testing-library/react";

import {
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";

import {
  createTestQueryClient,
} from "./render-query";

export async function renderUsersRoute(
  initialLocation = "/",
) {
  const queryClient = createTestQueryClient();

  const history = createMemoryHistory({
    initialEntries: [initialLocation],
  });

  const router = createRouter({
    routeTree,
    history,
  
    context: {
      queryClient,
    },
  
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await act(async () => {
    await router.load();
  });

  return {
    ...view,
    router,
    queryClient,
  };
}