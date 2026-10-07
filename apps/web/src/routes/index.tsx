import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/features/users/users-page";
import { usersQuerySchema, type UsersQueryParams } from "@crud/contracts/users";
import { useCallback } from "react";

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): UsersQueryParams => {
    // TanStack Router bisa membaca teks seperti "123"
    // atau "true" sebagai primitive JSON.
    // Untuk parameter pencarian, pertahankan sebagai teks.
    const searchText =
      typeof search.search === "number" ||
        typeof search.search === "boolean"
        ? String(search.search)
        : search.search;

    return usersQuerySchema.parse({
      ...search,
      search: searchText,
    })
  },

  component: UsersRoute,
});

function UsersRoute() {
  const params = Route.useSearch();
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
      params={params}
      onParamsChange={handleParamsChange}
    />
  );
}
