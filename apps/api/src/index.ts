import { serveStatic } from "@hono/bun";
import { app } from "./app";
import { env } from "./config/env";
import { sql } from "./db/client";
import { apiError } from "./lib/api-error";
import { markShuttingDown } from "./lib/runtime-state";

// Endpoint API yang tidak ditemukan harus tetap menghasilkan JSON.
app.all("/api", (c) =>
  apiError(c, 404, {
    code: "ENDPOINT_NOT_FOUND",
    message: "Endpoint tidak ditemukan",
  }),
);

app.all("/api/*", (c) =>
  apiError(c, 404, {
    code: "ENDPOINT_NOT_FOUND",
    message: "Endpoint tidak ditemukan",
  }),
);

if (env.NODE_ENV === "production") {
  // Asset Vite memiliki nama dengan hash.
  app.get(
    "/assets/*",
    serveStatic({
      root: "../web/dist",
      onFound: (_path, c) => {
        c.header(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
      },
    }),
  );

  // Asset yang hilang tidak boleh mendapatkan index.html.
  app.get("/assets/*", (c) => c.notFound());

  // File publik dan index.html harus dapat diperiksa ulang browser.
  app.get(
    "*",
    serveStatic({
      root: "../web/dist",
      onFound: (_path, c) => {
        c.header("Cache-Control", "no-cache");
      },
    }),
  );

  // Route SPA, misalnya /login, diselesaikan oleh TanStack Router.
  app.get(
    "*",
    serveStatic({
      path: "../web/dist/index.html",
      onFound: (_path, c) => {
        c.header("Cache-Control", "no-cache");
      },
    }),
  );
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
