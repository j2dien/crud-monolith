import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userInputSchema } from "@crud/contracts/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser, deleteUser, updateUser, type User } from "./user.api";
import { userKeys, usersQueryOptions } from "./user.queries";

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

export function UsersPage() {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const usersQuery = useQuery(usersQueryOptions());

  const deletion = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userKeys.all,
      });
    },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 bg-gray-400">
      <h1 className="text-2xl font-bold">Dashboard Pengguna</h1>

      <UserEditor
        key={editingUser?.id ?? "create"}
        user={editingUser}
        onDone={() => setEditingUser(null)}
      />

      {deletion.error && (
        <p role="alert" className="text-red-600">
          {deletion.error.message}
        </p>
      )}

      {usersQuery.isPending ? (
        <p>Memuat pengguna...</p>) : usersQuery.isError ? (
          <div role="alert" className="space-y-2">
            <p>{usersQuery.error.message}</p>
            <Button onClick={() => void usersQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : (
        <section aria-busy={usersQuery.isFetching}>
          {usersQuery.isFetching && (
            <p className="mb-2 text-sm text-muted-foreground">
              Memperbarui data...
            </p>
          )}

          {usersQuery.data.length === 0 ? (
            <p>Belum ada pengguna.</p>
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
                  {usersQuery.data.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-2">{user.name}</td>
                      <td className="p-2">{user.email}</td>
                      <td className="flex gap-2 p-2">
                        <Button variant="outline" disabled={deletion.isPending} onClick={() => setEditingUser(user)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={
                            deletion.isPending ||
                            editingUser?.id === user.id
                          }
                          onClick={() => {
                            if (
                              window.confirm(`Hapus ${user.name}?`)
                            ) {
                              deletion.mutate(user.id);
                            }
                          }}
                        >
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
