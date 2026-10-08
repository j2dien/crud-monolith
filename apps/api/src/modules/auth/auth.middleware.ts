import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";

import type {
  Account,
} from "@crud/contracts/auth";

import { apiError } from "../../lib/api-error";

import {
  SESSION_COOKIE,
} from "./auth.cookie";

import {
  getSessionAccount,
} from "./auth.service";

export type AuthEnv = {
  Variables: {
    requestId: string;
    account?: Account;
  };
};

export const requireAuth =
  createMiddleware<AuthEnv>(
    async (c, next) => {
      const token = getCookie(
        c,
        SESSION_COOKIE,
      );

      const account =
        await getSessionAccount(token);

      if (!account) {
        return apiError(c, 401, {
          code: "UNAUTHENTICATED",
          message: "Silakan login terlebih dahulu",
        });
      }

      c.set("account", account);

      await next();
    },
  );

export const requireAdmin =
  createMiddleware<AuthEnv>(
    async (c, next) => {
      const account = c.get("account");

      if (!account) {
        return apiError(c, 401, {
          code: "UNAUTHENTICATED",
          message: "Silakan login terlebih dahulu",
        });
      }

      if (account.role !== "admin") {
        return apiError(c, 403, {
          code: "FORBIDDEN",
          message:
            "Anda tidak memiliki izin untuk tindakan ini",
        });
      }

      await next();
    },
  );