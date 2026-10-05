import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { sql } from "./db/client";
import { userRoutes } from "./modules/users/user.routes";

function isUniqueViolation(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== "object" || current === null) return false;

    if ("code" in current && current.code === "23505") return true;

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export const app = new Hono()
  .use("*", requestId())
  .use("*", logger())
  .get("/api/health", async (c) => c.json({ status: "ok" }, 200))
  .get("/api/ready", async (c) => {
    try {
      await sql`select 1`;
      return c.json({ status: "ready" }, 200);
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  })
  .route("/api/users", userRoutes);

app.onError((error, c) => {
  if (isUniqueViolation(error)) {
    return c.json(
      {
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email sudah digunakan"
        },
      },
      409,
    );
  }

  console.error({
    requestId: c.get("requestId"),
    error,
  });

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server",
      },
    },
    500,
  );
});

export type AppType = typeof app;