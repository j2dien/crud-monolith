import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  and,
  eq,
  gt,
  sql as sqlExpression,
} from "drizzle-orm";

import type {
  Account,
} from "@crud/contracts/auth";

import { db } from "../../db/client";

import {
  accounts,
  loginAttempts,
  sessions,
} from "../../db/schema";

export const SESSION_SECONDS =
  7 * 24 * 60 * 60;

const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

export const MAX_LOGIN_ATTEMPTS = 5;

function sha256(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function validToken(token: string | undefined) {
  return (
    typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token)
  );
}

// Digunakan agar email yang tidak ditemukan tetap
// melakukan verifikasi password.
const dummyPasswordHash = Bun.password.hash(
  randomBytes(32).toString("hex"),
  { algorithm: "argon2id" },
);

export async function consumeLoginAttempt(
  email: string,
) {
  const now = Date.now();

  const window =
    Math.floor(now / LOGIN_WINDOW_MS);

  const key = sha256(
    `${email}:${window}`,
  );

  const expiresAt = new Date(
    (window + 1) * LOGIN_WINDOW_MS,
  );

  const [row] = await db
    .insert(loginAttempts)
    .values({
      key,
      attempts: 1,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        attempts: sqlExpression`
          ${loginAttempts.attempts} + 1
        `,
      },
    })
    .returning({
      attempts: loginAttempts.attempts,
    });

  if (!row) {
    throw new Error(
      "Login attempt was not recorded",
    );
  }

  return {
    allowed:
      row.attempts <= MAX_LOGIN_ATTEMPTS,

    retryAfter: Math.max(
      1,
      Math.ceil(
        (expiresAt.getTime() - now) / 1000,
      ),
    ),
  };
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Account | undefined> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  const hash =
    account?.passwordHash ??
    await dummyPasswordHash;

  const matches = await Bun.password.verify(
    password,
    hash,
  );

  if (!account || !matches) {
    return undefined;
  }

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
}

export async function createSession(
  accountId: string,
  previousToken?: string,
) {
  const token =
    randomBytes(32).toString("hex");

  const expiresAt = new Date(
    Date.now() + SESSION_SECONDS * 1000,
  );

  await db.transaction(async (tx) => {
    if (validToken(previousToken)) {
      await tx
        .delete(sessions)
        .where(
          eq(
            sessions.tokenHash,
            sha256(previousToken!),
          ),
        );
    }

    await tx.insert(sessions).values({
      tokenHash: sha256(token),
      accountId,
      expiresAt,
    });
  });

  return { token, expiresAt };
}

export async function getSessionAccount(
  token: string | undefined,
): Promise<Account | undefined> {
  if (!validToken(token)) {
    return undefined;
  }

  const [account] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      email: accounts.email,
      role: accounts.role,
    })
    .from(sessions)
    .innerJoin(
      accounts,
      eq(sessions.accountId, accounts.id),
    )
    .where(
      and(
        eq(
          sessions.tokenHash,
          sha256(token!),
        ),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return account;
}

export async function revokeSession(
  token: string | undefined,
) {
  if (!validToken(token)) {
    return;
  }

  await db
    .delete(sessions)
    .where(
      eq(
        sessions.tokenHash,
        sha256(token!),
      ),
    );
}