import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";

const client = postgres(env.DATABASE_URL, { max: 1 });

try {
  await migrate(drizzle(client), {
    migrationsFolder: "./drizzle"
  });

  console.log("Migration completed")
} finally {
  await client.end();
}