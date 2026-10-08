import { Hono } from "hono";

import {
  deleteCookie,
  getCookie,
  setCookie,
} from "hono/cookie";

import { zValidator } from "@hono/zod-validator";

import {
  loginSchema,
} from "@crud/contracts/auth";

import {
  apiError,
  validationHook,
} from "../../lib/api-error";

import type {
  AuthEnv,
} from "./auth.middleware";

import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./auth.cookie";

import {
  consumeLoginAttempt,
  createSession,
  getSessionAccount,
  revokeSession,
  SESSION_SECONDS,
  verifyCredentials,
} from "./auth.service";

export const authRoutes = new Hono<AuthEnv>()
  .post(
    "/login",
    zValidator(
      "json",
      loginSchema,
      validationHook,
    ),
    async (c) => {
      const input = c.req.valid("json");

      const limit = await consumeLoginAttempt(
        input.email,
      );

      if (!limit.allowed) {
        c.header(
          "Retry-After",
          String(limit.retryAfter),
        );

        return apiError(c, 429, {
          code: "TOO_MANY_LOGIN_ATTEMPTS",
          message:
            "Terlalu banyak percobaan login. Coba kembali nanti.",
        });
      }

      const account = await verifyCredentials(
        input.email,
        input.password,
      );

      if (!account) {
        return apiError(c, 401, {
          code: "INVALID_CREDENTIALS",
          message:
            "Email atau password tidak benar",
        });
      }

      const previousToken = getCookie(
        c,
        SESSION_COOKIE,
      );

      const session = await createSession(
        account.id,
        previousToken,
      );

      setCookie(
        c,
        SESSION_COOKIE,
        session.token,
        {
          ...sessionCookieOptions(),
          maxAge: SESSION_SECONDS,
          expires: session.expiresAt,
        },
      );

      return c.json({ data: account }, 200);
    },
  )
  .get("/me", async (c) => {
    const account = await getSessionAccount(
      getCookie(c, SESSION_COOKIE),
    );

    return c.json(
      { data: account ?? null },
      200,
    );
  })
  .post("/logout", async (c) => {
    await revokeSession(
      getCookie(c, SESSION_COOKIE),
    );

    deleteCookie(c, SESSION_COOKIE, {
      path: "/",
      secure:
        sessionCookieOptions().secure,
    });

    return c.json(
      { data: { success: true } },
      200,
    );
  });