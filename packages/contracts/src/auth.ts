import { z } from "zod";

export const accountRoleSchema = z.enum([
  "admin",
  "viewer",
]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),

  // Password tidak di-trim.
  password: z.string().min(1).max(128),
});

export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: accountRoleSchema,
});

export type LoginInput = z.infer<
  typeof loginSchema
>;

export type Account = z.infer<
  typeof accountSchema
>;

export type AccountRole = z.infer<
  typeof accountRoleSchema
>;