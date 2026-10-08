import { useCallback } from "react";

import {
  createFileRoute,
  redirect,
} from "@tanstack/react-router";

import {
  usersQuerySchema,
  type UsersQueryParams,
} from "@crud/contracts/users";

import {
  getCurrentAccount,
} from "@/features/auth/auth.api";

import {
  UsersPage,
} from "@/features/users/users-page";

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): UsersQueryParams => {
    const searchText =
      typeof search.search === "number" ||
      typeof search.search === "boolean"
        ? String(search.search)
        : search.search;

    return usersQuerySchema.parse({
      ...search,
      search: searchText,
    });
  },

  beforeLoad: async ({
    context,
    abortController,
  }) => {
    const account = await getCurrentAccount(
      abortController.signal,
    );

    if (!account) {
      await context.queryClient.cancelQueries();
      context.queryClient.clear();

      throw redirect({
        to: "/login",
        replace: true,
      });
    }

    return { account };
  },

  pendingComponent: () => (
    <main className="p-6" role="status">
      Memeriksa session...
    </main>
  ),

  component: UsersRoute,
});

function UsersRoute() {
  const params = Route.useSearch();
  const { account } = Route.useRouteContext();
  const navigate = Route.useNavigate();

  const handleParamsChange = useCallback(
    async (
      patch: Partial<UsersQueryParams>,
      options?: { replace?: boolean },
    ) => {
      await navigate({
        to: "/",
        search: (previous) => ({
          ...previous,
          ...patch,
        }),
        replace: options?.replace ?? false,
      });
    },
    [navigate],
  );

  return (
    <UsersPage
      account={account}
      params={params}
      onParamsChange={handleParamsChange}
    />
  );
}