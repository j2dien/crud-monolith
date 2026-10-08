import type { ReactElement } from "react";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { render } from "@testing-library/react";

const clients = new Set<QueryClient>();

export function createTestQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },

      mutations: {
        retry: false,
      },
    },
  });

  clients.add(client);

  return client;
}

export function disposeTestQueryClients() {
  for (const client of clients) {
    client.clear();
  }

  clients.clear();
}

export function renderWithQuery(
  element: ReactElement,
) {
  const queryClient = createTestQueryClient();

  const view = render(
    <QueryClientProvider client={queryClient}>
      {element}
    </QueryClientProvider>,
  );

  return {
    ...view,
    queryClient,
  };
}