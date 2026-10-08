import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useNavigate } from "@tanstack/react-router";

import type {
  Account,
} from "@crud/contracts/auth";

import { Button } from "@/components/ui/button";

import { logout } from "./auth.api";

type SessionMenuProps = {
  account: Account;
};

export function SessionMenu({
  account,
}: SessionMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: logout,

    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();

      await navigate({
        to: "/login",
        replace: true,
      });
    },
  });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {account.name}
          </p>

          <p className="text-sm text-muted-foreground">
            {account.email} · {account.role}
          </p>
        </div>

        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "Keluar..."
            : "Keluar"}
        </Button>
      </div>

      {mutation.error && (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}