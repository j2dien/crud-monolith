import {
  accountSchema,
  loginSchema,
  type LoginInput,
} from "@crud/contracts/auth";

import { rpc } from "@/lib/rpc";
import { throwApiError } from "@/lib/api-error";

export async function getCurrentAccount(
  signal?: AbortSignal,
) {
  const response = await rpc.api.auth.me.$get(
    {},
    {
      init: { signal },
    },
  );

  if (response.status !== 200) {
    return throwApiError(response);
  }

  const body = await response.json();

  return accountSchema
    .nullable()
    .parse(body.data);
}

export async function login(
  input: LoginInput,
) {
  const response =
    await rpc.api.auth.login.$post({
      json: loginSchema.parse(input),
    });

  if (response.status !== 200) {
    return throwApiError(response);
  }

  const body = await response.json();

  return accountSchema.parse(body.data);
}

export async function logout() {
  const response =
    await rpc.api.auth.logout.$post({});

  if (response.status !== 200) {
    return throwApiError(response);
  }

  return (await response.json()).data;
}