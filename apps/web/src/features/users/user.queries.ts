import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { UsersQueryParams } from "@crud/contracts/users";

import { listUsers } from "./user.api";

export const userKeys = {
  all: ["users"] as const,

  lists: () => [...userKeys.all, "list"] as const,

  list: (params: UsersQueryParams) =>
    [...userKeys.lists(), params] as const
};

export const usersQueryOptions = (
  params: UsersQueryParams,
) =>
  queryOptions({
    queryKey: userKeys.list(params),

    queryFn: ({ signal }) => listUsers(params, signal),

    staleTime: 30_000,

    placeholderData: keepPreviousData,
  });
