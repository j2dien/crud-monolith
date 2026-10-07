import type { InferResponseType } from "hono/client";
import type { UserInput, UsersQueryParams } from "@crud/contracts/users";
import { rpc } from "@/lib/rpc";
import { throwApiError } from "@/lib/api-error";
export type User = InferResponseType<typeof rpc.api.users.$get, 200>["data"][number];

export async function listUsers(
  params: UsersQueryParams,
  signal?: AbortSignal,
) {
  const response = await rpc.api.users.$get(
    {
      query: {
        page: String(params.page),
        pageSize: String(params.pageSize),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(params.search
          ? { search: params.search }
          : {}),
      },
    },
    { init: { signal } },
  );

  if (response.status !== 200) {
    return throwApiError(response);
  }

  return response.json();
}

export async function createUser(input: UserInput) {
  const response = await rpc.api.users.$post({ json: input });

  if (response.status !== 201) {
    return throwApiError(response);
  }

  return (await response.json()).data;
}

export async function updateUser(id: string, input: UserInput) {
  const response = await rpc.api.users[":id"].$put({
    param: { id },
    json: input,
  });

  if (response.status !== 200) {
    return throwApiError(response);
  }

  return (await response.json()).data;
}

export async function deleteUser(id: string) {
  const response = await rpc.api.users[":id"].$delete({
    param: { id },
  });

  if (response.status !== 200) {
    return throwApiError(response)
  }

  return (await response.json()).data;
}
