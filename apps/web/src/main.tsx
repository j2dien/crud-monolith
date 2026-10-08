import React from "react";
import ReactDOM from "react-dom/client";

import {
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import {
  createAppQueryClient,
} from "./lib/create-query-client";

import { routeTree } from "./routeTree.gen";
import "./index.css";

let redirectingToLogin = false;

const queryClient = createAppQueryClient(
  () => {
    void redirectToLogin();
  },
);

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
});

async function redirectToLogin() {
  if (redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;

  try {
    await queryClient.cancelQueries();
    queryClient.clear();

    await router.navigate({
      to: "/login",
      replace: true,
    });
  } catch {
    window.location.replace("/login");
  } finally {
    redirectingToLogin = false;
  }
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);