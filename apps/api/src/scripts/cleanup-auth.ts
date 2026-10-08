import { sql } from "../db/client";
import { cleanupExpiredAuthData } from "../modules/auth/auth.maintenance";

try {
  const result = await cleanupExpiredAuthData();

  console.info(
    JSON.stringify({
      event: "auth_cleanup_completed",
      ...result,
    }),
  );
} catch (error) {
  console.error({
    event: "auth_cleanup_failed",
    error,
  });

  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}