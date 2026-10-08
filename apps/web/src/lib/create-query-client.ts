import {
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";

import { ApiError } from "./api-error";

export function createAppQueryClient(
  onSessionExpired: () => void,
) {
  function handleError(error: unknown) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "UNAUTHENTICATED"
    ) {
      onSessionExpired();
    }
  }

  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleError,
    }),

    mutationCache: new MutationCache({
      onError: handleError,
    }),

    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }

          return failureCount < 2;
        },
      },

      mutations: {
        retry: false,
      },
    },
  });
}