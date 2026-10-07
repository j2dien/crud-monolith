import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { sql } from "./db/client";
import { apiError } from "./lib/api-error";
import { userRoutes } from "./modules/users/user.routes";

function findPostgresError(error: unknown) {
  let current = error;

  for (let depth = 0; depth < 5; depth++) {
    if (
      typeof current !== "object" ||
      current === null
    ) {
      return undefined;
    }

    if (
      "code" in current &&
      typeof current.code === "string"
    ) {
      return {
        code: current.code,

        constraintName:
          "constraint_name" in current &&
          typeof current.constraint_name === "string"
            ? current.constraint_name
            : undefined,
      };
    }

    current =
      "cause" in current
        ? current.cause
        : undefined;
  }

  return undefined;
}

export const app = new Hono()
  .use("*", requestId())
  .use("*", logger())
  .get("/api/health", (c) =>
    c.json({ status: "ok" }, 200),
  )
  .get("/api/ready", async (c) => {
    try {
      await sql`select 1`;

      return c.json({ status: "ready" }, 200);
    } catch {
      return c.json(
        { status: "unavailable" },
        503,
      );
    }
  })
  .route("/api/users", userRoutes);

app.onError((error, c) => {
  const postgresError = findPostgresError(error);

  if (
    postgresError?.code === "23505" &&
    postgresError.constraintName ===
      "users_email_unique"
  ) {
    return apiError(c, 409, {
      code: "EMAIL_ALREADY_EXISTS",
      message: "Email sudah digunakan",
      fields: {
        email: ["Email sudah digunakan"],
      },
    });
  }

  // Hono dapat melempar HTTPException ketika parsing
  // JSON gagal, sebelum validasi Zod dijalankan.
  if (
    error instanceof HTTPException &&
    error.status < 500
  ) {
    return apiError(c, error.status, {
      code:
        error.status === 400
          ? "BAD_REQUEST"
          : "HTTP_ERROR",

      message:
        error.status === 400
          ? "Request tidak valid. Periksa format JSON."
          : "Request tidak dapat diproses",
    });
  }

  console.error({
    requestId: c.get("requestId"),
    error,
  });

  return apiError(c, 500, {
    code: "INTERNAL_ERROR",
    message: "Terjadi kesalahan pada server",
  });
});

export type AppType = typeof app;