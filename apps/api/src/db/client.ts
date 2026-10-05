import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  connect_timeout: 10,
});

export const db = drizzle(sql);