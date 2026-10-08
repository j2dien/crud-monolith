import { serveStatic } from "@hono/bun";
import { app } from "./app";
import { env } from "./config/env";
import { sql } from "./db/client";
import { apiError } from "./lib/api-error";
import { markShuttingDown } from "./lib/runtime-state";

app.all("/api/*", (c) =>
  apiError(c, 404, {
    code: "ENDPOINT_NOT_FOUND",
    message: "Endpoint tidak ditemukan",
  }),
);

if (env.NODE_ENV === "production") {
  app.get("*", serveStatic({ root: "../web/dist" }));

  app.get("*", async (c) => {
    // Asset yang hilang harus 404, bukan menerima HTML.
    if (c.req.path.startsWith("/assets/")) {
      return c.notFound();
    }

    return serveStatic({ path: "../web/dist/index.html" })(c, async () => {});
  });
}

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: env.PORT,
  development: env.NODE_ENV === "development",
  fetch: app.fetch,
});

console.info(
  JSON.stringify({
    event: "server_started",
    port: server.port,
    environment: env.NODE_ENV,
  }),
);

let shutdownStarted = false;

async function shutdown(
  signal: "SIGINT" | "SIGTERM",
) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  markShuttingDown();

  console.info(
    JSON.stringify({
      event: "shutdown_started",
      signal,
    }),
  );

  // Batas total shutdown, termasuk penutupan database.
  const deadline = setTimeout(() => {
    console.error(
      JSON.stringify({
        event: "shutdown_timeout",
      }),
    );

    process.exit(1);
  }, 25_000);

  try {
    await server.stop(false);

    // Tutup database setelah request aktif selesai.
    await sql.end({ timeout: 5 });

    clearTimeout(deadline);

    console.info(
      JSON.stringify({
        event: "shutdown_completed",
      }),
    );

    process.exit(0);
  } catch (error) {
    clearTimeout(deadline);

    console.error({
      event: "shutdown_failed",
      error,
    });

    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
