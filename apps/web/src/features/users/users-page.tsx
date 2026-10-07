import { useEffect, useState } from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  type UsersQueryParams,
} from "@crud/contracts/users";

import { Button } from "@/components/ui/button";

import {
  deleteUser,
  type User,
} from "./user.api";

import {
  userKeys,
  usersQueryOptions,
} from "./user.queries";

import { UserEditor } from "./user-editor";
import { UsersToolbar } from "./users-toolbar";

type UsersPageProps = {
  params: UsersQueryParams;

  onParamsChange: (
    patch: Partial<UsersQueryParams>,
    options?: { replace?: boolean },
  ) => Promise<void>;
};

export function UsersPage({
  params,
  onParamsChange,
}: UsersPageProps) {
  const [editingUser, setEditingUser] =
    useState<User | null>(null);

  const queryClient = useQueryClient();

  const usersQuery = useQuery(
    usersQueryOptions(params),
  );

  const deletion = useMutation({
    mutationFn: deleteUser,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userKeys.all,
      });
    },
  });

  const meta = usersQuery.data?.meta;

  // Koreksi halaman setelah penghapusan atau ketika URL
  // menunjuk halaman yang sudah tidak tersedia.
  useEffect(() => {
    if (
      !meta ||
      usersQuery.isFetching ||
      usersQuery.isPlaceholderData ||
      usersQuery.isError
    ) {
      return;
    }

    const lastPage = Math.max(1, meta.totalPages);

    if (params.page > lastPage) {
      void onParamsChange(
        { page: lastPage },
        { replace: true },
      );
    }
  }, [
    meta,
    params.page,
    usersQuery.isFetching,
    usersQuery.isPlaceholderData,
    usersQuery.isError,
    onParamsChange,
  ]);

  const isUpdating =
    usersQuery.isFetching &&
    !usersQuery.isPending;

  const actionsDisabled =
    deletion.isPending ||
    usersQuery.isPlaceholderData;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">
        Dashboard Pengguna
      </h1>

      <UserEditor
        key={editingUser?.id ?? "create"}
        user={editingUser}
        onDone={() => setEditingUser(null)}
      />

      <UsersToolbar
        params={params}
        onParamsChange={onParamsChange}
      />

      {deletion.error && (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {deletion.error.message}
        </p>
      )}

      {usersQuery.isPending ? (
        <p role="status">
          Memuat pengguna...
        </p>
      ) : !usersQuery.data ? (
        <div
          role="alert"
          className="space-y-2"
        >
          <p>
            {usersQuery.error?.message ??
              "Data gagal dimuat."}
          </p>

          <Button
            onClick={() => {
              void usersQuery.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : (
        <section
          className="space-y-4"
          aria-busy={usersQuery.isFetching}
        >
          <div
            className="min-h-5 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {isUpdating
              ? "Memperbarui data..."
              : `Ditemukan ${usersQuery.data.meta.total} pengguna.`}
          </div>

          {usersQuery.isError && (
            <div
              role="alert"
              className="space-y-2"
            >
              <p className="text-sm text-red-600">
                Pembaruan gagal:{" "}
                {usersQuery.error.message}
              </p>

              <Button
                variant="outline"
                onClick={() => {
                  void usersQuery.refetch();
                }}
              >
                Coba lagi
              </Button>
            </div>
          )}

          <div
            className={
              usersQuery.isPlaceholderData
                ? "opacity-60"
                : undefined
            }
          >
            {usersQuery.data.data.length === 0 ? (
              <p>
                {params.search
                  ? "Tidak ada pengguna yang cocok dengan pencarian."
                  : "Belum ada pengguna pada halaman ini."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Nama</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usersQuery.data.data.map(
                      (user) => (
                        <tr
                          key={user.id}
                          className="border-b"
                        >
                          <td className="p-2">
                            {user.name}
                          </td>

                          <td className="p-2">
                            {user.email}
                          </td>

                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                disabled={actionsDisabled}
                                onClick={() => {
                                  setEditingUser(user);
                                }}
                              >
                                Edit
                              </Button>

                              <Button
                                variant="destructive"
                                disabled={
                                  actionsDisabled ||
                                  editingUser?.id ===
                                    user.id
                                }
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Hapus ${user.name}?`,
                                    )
                                  ) {
                                    deletion.mutate(
                                      user.id,
                                    );
                                  }
                                }}
                              >
                                Hapus
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {usersQuery.data.meta.total === 0
                ? "0 pengguna"
                : `Halaman ${usersQuery.data.meta.page} dari ${usersQuery.data.meta.totalPages} · Total ${usersQuery.data.meta.total} pengguna`}
            </p>

            <nav
              className="flex gap-2"
              aria-label="Pagination pengguna"
            >
              <Button
                variant="outline"
                disabled={
                  params.page <= 1 ||
                  usersQuery.isFetching ||
                  usersQuery.isPlaceholderData
                }
                onClick={() => {
                  void onParamsChange({
                    page: params.page - 1,
                  });
                }}
              >
                Sebelumnya
              </Button>

              <Button
                variant="outline"
                disabled={
                  usersQuery.isFetching ||
                  usersQuery.isPlaceholderData ||
                  params.page >=
                    usersQuery.data.meta.totalPages
                }
                onClick={() => {
                  void onParamsChange({
                    page: params.page + 1,
                  });
                }}
              >
                Berikutnya
              </Button>
            </nav>
          </div>
        </section>
      )}
    </main>
  );
}
