import { queryOptions } from "@tanstack/react-query";
import { listUsers } from "./user.api";

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

export const usersQueryOptions = () =>
  queryOptions({
    queryKey: userKeys.list(),
    queryFn: ({ signal }) => listUsers(signal),
    staleTime: 30_000,
  });
