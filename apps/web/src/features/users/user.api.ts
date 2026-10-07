import { z } from "zod";
import type { InferResponseType } from "hono/client";
import type { UserInput } from "@crud/contracts/users";
import { rpc } from "@/lib/rpc";

export type User = InferResponseType<typeof rpc.api.users.$get, 200>["data"][number];

const errorSchema = z.object({
  error: z.object({
    message: z.string(),
  })
})

async function throwApiError(response: {
  status: number;
  json(): Promise<unknown>;
}): Promise<never> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorSchema.safeParse(body);

  throw new Error(
    parsed.success
      ? parsed.data.error.message
      : `Request gagal (${response.status})`
  )
}

export async function listUsers(signal?: AbortSignal) {
  const response = await rpc.api.users.$get(
    {
      query: {},
    },
    { init: { signal } },
  );

  if (response.status !== 200) {
    return throwApiError(response);
  }

  return (await response.json()).data;
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
