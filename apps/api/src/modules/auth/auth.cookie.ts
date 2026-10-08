import { env } from "../../config/env";

export const SESSION_COOKIE =
  env.NODE_ENV === "production"
    ? "__Host-session"
    : "session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
  };
}