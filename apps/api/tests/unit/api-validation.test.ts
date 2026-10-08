import {
  describe,
  expect,
  mock,
  test,
} from "bun:test";

import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { zValidator } from "@hono/zod-validator";

import {
  userInputSchema,
  type UserInput,
} from "@crud/contracts/users";

import {
  apiErrorResponseSchema,
} from "@crud/contracts/errors";

import {
  apiError,
  validationHook,
} from "../../src/lib/api-error";

function createTestApp() {
  const handler = mock((input: UserInput) => input);

  const app = new Hono()
    .use("*", requestId())
    .post(
      "/users",
      zValidator(
        "json",
        userInputSchema,
        validationHook,
      ),
      (c) => {
        const input = c.req.valid("json");

        return c.json({
          data: handler(input),
        }, 201);
      },
    )
    .get("/missing", (c) =>
      apiError(c, 404, {
        code: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      }),
    );

  return { app, handler };
}

describe("API validation helpers", () => {
  test("rejects invalid input before the handler runs", async () => {
    const { app, handler } = createTestApp();

    const response = await app.request("/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "A",
        email: "bukan-email",
      }),
    });

    expect(response.status).toBe(400);
    expect(handler).toHaveBeenCalledTimes(0);

    const body = apiErrorResponseSchema.parse(
      await response.json(),
    );

    expect(body.error.code).toBe("VALIDATION_ERROR");

    expect(
      body.error.fields?.name?.length,
    ).toBeGreaterThan(0);

    expect(
      body.error.fields?.email?.length,
    ).toBeGreaterThan(0);

    expect(body.error.requestId).toBeTruthy();

    expect(body.error.requestId).toBe(
      response.headers.get("x-request-id") ?? undefined,
    );
  });

  test("passes normalized input to the handler", async () => {
    const { app, handler } = createTestApp();

    const response = await app.request("/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "  Didin Rudini  ",
        email: "  DIDIN@EXAMPLE.COM  ",
      }),
    });

    expect(response.status).toBe(201);

    expect(handler).toHaveBeenCalledTimes(1);

    expect(handler).toHaveBeenCalledWith({
      name: "Didin Rudini",
      email: "didin@example.com",
    });
  });

  test("returns a standard error with a request ID", async () => {
    const { app } = createTestApp();

    const response = await app.request("/missing");

    expect(response.status).toBe(404);

    const body = apiErrorResponseSchema.parse(
      await response.json(),
    );

    expect(body.error.code).toBe("USER_NOT_FOUND");

    expect(body.error.requestId).toBe(
      response.headers.get("x-request-id") ?? undefined,
    );
  });
});