import { useState } from "react";
import { useForm } from "@tanstack/react-form";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useNavigate } from "@tanstack/react-router";

import {
  loginSchema,
  type LoginInput,
} from "@crud/contracts/auth";

import {
  usersQuerySchema,
} from "@crud/contracts/users";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-error";

import { login } from "./auth.api";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [message, setMessage] =
    useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: LoginInput) =>
      login(input),
  });

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },

    validators: {
      onChange: loginSchema,
      onSubmit: loginSchema,
    },

    onSubmit: async ({ value }) => {
      setMessage(null);

      try {
        await mutation.mutateAsync(
          loginSchema.parse(value),
        );

        // Bersihkan hasil dari session sebelumnya.
        await queryClient.cancelQueries();
        queryClient.clear();

        await navigate({
          to: "/",
          search: usersQuerySchema.parse({}),
          replace: true,
        });
      } catch (error) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "Login gagal. Periksa koneksi lalu coba kembali.",
        );
      }
    },
  });

  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <form
        noValidate
        className="w-full space-y-4 rounded-lg border p-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();

          void form.handleSubmit();
        }}
      >
        <h1 className="text-2xl font-bold">
          Login
        </h1>

        <p className="text-sm text-muted-foreground">
          Masuk menggunakan akun aplikasi.
        </p>

        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="login-email">
                Email
              </Label>

              <Input
                id="login-email"
                name={field.name}
                type="email"
                autoComplete="username"
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setMessage(null);

                  field.handleChange(
                    event.target.value,
                  );
                }}
              />

              {field.state.meta.errors.map(
                (error, index) => (
                  <p
                    key={index}
                    role="alert"
                    className="text-sm text-red-600"
                  >
                    {typeof error === "string"
                      ? error
                      : error?.message}
                  </p>
                ),
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="login-password">
                Password
              </Label>

              <Input
                id="login-password"
                name={field.name}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setMessage(null);

                  field.handleChange(
                    event.target.value,
                  );
                }}
              />

              {field.state.meta.errors.map(
                (error, index) => (
                  <p
                    key={index}
                    role="alert"
                    className="text-sm text-red-600"
                  >
                    {typeof error === "string"
                      ? error
                      : error?.message}
                  </p>
                ),
              )}
            </div>
          )}
        </form.Field>

        {message && (
          <p
            role="alert"
            className="text-sm text-red-600"
          >
            {message}
          </p>
        )}

        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
          ]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={
                !canSubmit ||
                isSubmitting ||
                mutation.isPending
              }
            >
              {isSubmitting || mutation.isPending
                ? "Memproses..."
                : "Masuk"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </main>
  );
}