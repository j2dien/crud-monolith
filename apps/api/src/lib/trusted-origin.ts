import { createMiddleware } from "hono/factory";

import { env } from "../config/env";
import { apiError } from "./api-error";

import type {
  AuthEnv,
} from "../modules/auth/auth.middleware";

export const trustedOrigin =
  createMiddleware<AuthEnv>(
    async (c, next) => {
      c.header("Cache-Control", "no-store");

      const safeMethods = [
        "GET",
        "HEAD",
        "OPTIONS",
      ];

      if (
        !safeMethods.includes(c.req.method)
      ) {
        const origin =
          c.req.header("Origin");

        if (origin !== env.APP_ORIGIN) {
          return apiError(c, 403, {
            code: "INVALID_ORIGIN",
            message:
              "Origin request tidak diizinkan",
          });
        }
      }

      await next();
    },
  );