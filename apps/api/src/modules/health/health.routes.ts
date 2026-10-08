import { Hono } from "hono";

import { sql } from "../../db/client";
import { isShuttingDown } from "../../lib/runtime-state";

export const healthRoutes = new Hono()
  .get("/health", (c) => {
    c.header("Cache-Control", "no-store");

    return c.json({
      status: "ok",
    });
  })
  .get("/ready", async (c) => {
    c.header("Cache-Control", "no-store");

    if (isShuttingDown()) {
      return c.json(
        { status: "unavailable" },
        503,
      );
    }

    try {
      await sql`select 1`;

      // Shutdown bisa dimulai ketika query sedang berjalan.
      if (isShuttingDown()) {
        return c.json(
          { status: "unavailable" },
          503,
        );
      }

      return c.json({
        status: "ready",
      });
    } catch {
      return c.json(
        { status: "unavailable" },
        503,
      );
    }
  });