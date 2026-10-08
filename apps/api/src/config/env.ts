import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),

  APP_ORIGIN: z
      .url()
      .transform((value) => new URL(value).origin),
  }).superRefine((value, ctx) => {
    if (
      value.NODE_ENV === "production" &&
      !value.APP_ORIGIN.startsWith("https://")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ORIGIN"],
        message:
          "Production APP_ORIGIN must use HTTPS",
    });
  }
});

export const env = envSchema.parse(
  process.env
);
