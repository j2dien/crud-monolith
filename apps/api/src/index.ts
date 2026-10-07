import { serveStatic } from "@hono/bun";
import { app } from "./app";
import { env } from "./config/env";
import { sql } from "./db/client";
import { apiError } from "./lib/api-error";

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
  fetch: app.fetch,
});

console.log(`Server listening on port ${server.port}`);

let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;

  await server.stop();
  await sql.end({ timeout: 5 })
}

process.on(("SIGTERM"), () => {
  void shutdown();
})

process.on("SIGINT", () => {
  void shutdown();
})
