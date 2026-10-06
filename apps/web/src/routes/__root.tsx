import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="p-6">Halaman tidak ditemukan.</main>
  ),
  errorComponent: ({ error }) => (
    <main className="p-6" role="alert">
      Terjadi kesalahan:{" "}
      {error instanceof Error ? error.message : "Kesalahan tidak diketahui"}
    </main>
  ),
});