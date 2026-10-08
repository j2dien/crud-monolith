import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),

  APP_ORIGINS: z
    .string()
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(
      z.array(
        z.url().transform((value) => new URL(value).origin),
      ).min(1),
    ),

  }).superRefine((value, ctx) => {
    if (
      value.NODE_ENV === "production" &&
      value.APP_ORIGINS.some((origin) => !origin.startsWith("https://"))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ORIGINS"],
        message: "Production APP_ORIGINS must use HTTPS",
      });
    }

});

export const env = envSchema.parse(
  process.env
);
