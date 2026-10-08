import { lte } from "drizzle-orm";

import { db } from "../../db/client";
import {
  loginAttempts,
  sessions,
} from "../../db/schema";

export async function cleanupExpiredAuthData(
  now: Date = new Date(),
) {
  return db.transaction(async (tx) => {
    const deletedSessions = await tx
      .delete(sessions)
      .where(lte(sessions.expiresAt, now))
      .returning({
        accountId: sessions.accountId,
      });

    const deletedLoginAttempts = await tx
      .delete(loginAttempts)
      .where(lte(loginAttempts.expiresAt, now))
      .returning({
        expiresAt: loginAttempts.expiresAt,
      });

    return {
      deletedSessions: deletedSessions.length,
      deletedLoginAttempts: deletedLoginAttempts.length,
    };
  });
}