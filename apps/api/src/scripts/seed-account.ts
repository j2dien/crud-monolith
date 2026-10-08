import { z } from "zod";

import {
  accountRoleSchema,
} from "@crud/contracts/auth";

import { db, sql } from "../db/client";
import { accounts } from "../db/schema";

const seedSchema = z.object({
  SEED_NAME: z.string()
    .trim()
    .min(2)
    .max(100),

  SEED_EMAIL: z.string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254)),

  SEED_PASSWORD: z.string()
    .min(8)
    .max(128),

  SEED_ROLE: accountRoleSchema,
});

try {
  const input = seedSchema.parse(
    process.env,
  );

  const passwordHash =
    await Bun.password.hash(
      input.SEED_PASSWORD,
      { algorithm: "argon2id" },
    );

  const [account] = await db
    .insert(accounts)
    .values({
      name: input.SEED_NAME,
      email: input.SEED_EMAIL,
      passwordHash,
      role: input.SEED_ROLE,
    })
    .onConflictDoNothing({
      target: accounts.email,
    })
    .returning({
      id: accounts.id,
    });

  console.log(
    account
      ? "Account created"
      : "Account already exists; no changes applied",
  );
} finally {
  await sql.end({ timeout: 5 });
}