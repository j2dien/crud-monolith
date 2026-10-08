import type {
  QueryClient,
} from "@tanstack/react-query";

import {
  createRootRouteWithContext,
  Outlet,
} from "@tanstack/react-router";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route =
  createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,

    notFoundComponent: () => (
      <main className="p-6">
        Halaman tidak ditemukan.
      </main>
    ),

    errorComponent: ({ error }) => (
      <main
        className="space-y-2 p-6"
        role="alert"
      >
        <p>Halaman gagal dimuat.</p>
        <p>{error instanceof Error ? error.message : "Kesalahan tidak diketahui"}</p>
        <p>
          Periksa koneksi, lalu muat ulang halaman.
        </p>
      </main>
    ),
  });