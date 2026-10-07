import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  userInputSchema,
  type UsersQueryParams,
} from "@crud/contracts/users";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createUser,
  deleteUser,
  updateUser,
  type User,
} from "./user.api";

import {
  userKeys,
  usersQueryOptions,
} from "./user.queries";

import { UsersToolbar } from "./users-toolbar";

type EditorProps = {
  user: User | null;
  onDone: () => void;
};

function UserEditor({ user, onDone }: EditorProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
    }) => {
      const parsed = userInputSchema.parse(input);

      return user
        ? updateUser(user.id, parsed)
        : createUser(parsed);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userKeys.all
      });
    },
  });

  const form = useForm({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },
    validators: {
      onBlur: userInputSchema,
      onSubmit: userInputSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(value);
        form.reset();
        onDone();
      } catch {
        // Error ditampilkan melalui mutation.error.
      }
    },
  });

  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    }}>
      <h2 className="font-semibold">
        {user ? "Edit pengguna" : "Tambah pengguna"}
      </h2>

      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Nama</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) =>
                field.handleChange(event.target.value)
              }
            />
            {field.state.meta.errors.map((error, index) => (
              <p key={index} role="alert" className="text-sm text-red-600">
                {typeof error === "string" ? error : error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) =>
                field.handleChange(event.target.value)
              }
            />
            {field.state.meta.errors.map((error, index) => (
              <p key={index} role="alert" className="text-sm text-red-600">
                {typeof error === "string" ? error : error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      {mutation.error && (
        <p role="alert" className="text-sm text-red-600">
          {mutation.error.message}
        </p>
      )}

      <div className="flex gap-2">
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          )}
        </form.Subscribe>

        {user && (
          <Button type="button" variant="outline" onClick={onDone}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

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
