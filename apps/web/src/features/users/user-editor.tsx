import { useState } from "react";
import { useForm } from "@tanstack/react-form";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  userInputSchema,
  type UserInput,
} from "@crud/contracts/users";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-error";

import {
  createUser,
  updateUser,
  type User,
} from "./user.api";

import { userKeys } from "./user.queries";

type UserEditorProps = {
  user: User | null;
  onDone: () => void;
};

type SubmitFailure = {
  fields: Partial<
    Record<keyof UserInput, string[]>
  >;

  message?: string;
  requestId?: string;
};

export function UserEditor({
  user,
  onDone,
}: UserEditorProps) {
  const queryClient = useQueryClient();

  const [failure, setFailure] =
    useState<SubmitFailure | null>(null);

  const mutation = useMutation({
    mutationFn: (input: UserInput) =>
      user
        ? updateUser(user.id, input)
        : createUser(input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userKeys.all,
      });
    },
  });

  function clearFieldError(
    fieldName: keyof UserInput,
  ) {
    setFailure((previous) => {
      if (!previous) {
        return null;
      }

      const fields = { ...previous.fields };
      delete fields[fieldName];

      return Object.keys(fields).length > 0
        ? { fields }
        : null;
    });
  }

  const form = useForm({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },

    validators: {
      onChange: userInputSchema,
      onSubmit: userInputSchema,
    },

    onSubmit: async ({ value }) => {
      setFailure(null);

      try {
        const input = userInputSchema.parse(value);

        await mutation.mutateAsync(input);

        form.reset();
        onDone();
      } catch (error) {
        if (error instanceof ApiError) {
          const fields: SubmitFailure["fields"] = {};

          if (error.fields.name?.length) {
            fields.name = error.fields.name;
          }

          if (error.fields.email?.length) {
            fields.email = error.fields.email;
          }

          setFailure({
            fields,

            message:
              Object.keys(fields).length === 0
                ? error.message
                : undefined,

            requestId: error.requestId,
          });

          return;
        }

        setFailure({
          fields: {},
          message:
            "Penyimpanan gagal. Periksa koneksi lalu coba kembali.",
        });
      }
    },
  });

  return (
    <form
      noValidate
      className="space-y-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        void form.handleSubmit();
      }}
    >
      <h2 className="font-semibold">
        {user ? "Edit pengguna" : "Tambah pengguna"}
      </h2>

      <form.Field name="name">
        {(field) => {
          const localErrors =
            field.state.meta.errors;

          const serverErrors =
            failure?.fields.name ?? [];

          const hasErrors =
            localErrors.length > 0 ||
            serverErrors.length > 0;

          return (
            <div className="space-y-2">
              <Label htmlFor="user-name">
                Nama
              </Label>

              <Input
                id="user-name"
                name={field.name}
                value={field.state.value}
                disabled={mutation.isPending}
                aria-invalid={hasErrors}
                aria-describedby={
                  hasErrors
                    ? "user-name-errors"
                    : undefined
                }
                onBlur={field.handleBlur}
                onChange={(event) => {
                  clearFieldError("name");

                  field.handleChange(
                    event.target.value,
                  );
                }}
              />

              {hasErrors && (
                <div
                  id="user-name-errors"
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {localErrors.map(
                    (error, index) => (
                      <p key={`local-${index}`}>
                        {typeof error === "string"
                          ? error
                          : error?.message}
                      </p>
                    ),
                  )}

                  {serverErrors.map(
                    (message, index) => (
                      <p key={`server-${index}`}>
                        {message}
                      </p>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        }}
      </form.Field>

      <form.Field name="email">
        {(field) => {
          const localErrors =
            field.state.meta.errors;

          const serverErrors =
            failure?.fields.email ?? [];

          const hasErrors =
            localErrors.length > 0 ||
            serverErrors.length > 0;

          return (
            <div className="space-y-2">
              <Label htmlFor="user-email">
                Email
              </Label>

              <Input
                id="user-email"
                name={field.name}
                type="email"
                value={field.state.value}
                disabled={mutation.isPending}
                aria-invalid={hasErrors}
                aria-describedby={
                  hasErrors
                    ? "user-email-errors"
                    : undefined
                }
                onBlur={field.handleBlur}
                onChange={(event) => {
                  clearFieldError("email");

                  field.handleChange(
                    event.target.value,
                  );
                }}
              />

              {hasErrors && (
                <div
                  id="user-email-errors"
                  role="alert"
                  className="text-sm text-red-600"
                >
                  {localErrors.map(
                    (error, index) => (
                      <p key={`local-${index}`}>
                        {typeof error === "string"
                          ? error
                          : error?.message}
                      </p>
                    ),
                  )}

                  {serverErrors.map(
                    (message, index) => (
                      <p key={`server-${index}`}>
                        {message}
                      </p>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        }}
      </form.Field>

      {failure?.message && (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {failure.message}
        </p>
      )}

      {failure?.requestId && (
        <p className="text-xs text-muted-foreground">
          ID request: {failure.requestId}
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
            <Button
              type="submit"
              disabled={
                !canSubmit ||
                isSubmitting ||
                mutation.isPending
              }
            >
              {isSubmitting || mutation.isPending
                ? "Menyimpan..."
                : "Simpan"}
            </Button>
          )}
        </form.Subscribe>

        {user && (
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={onDone}
          >
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}