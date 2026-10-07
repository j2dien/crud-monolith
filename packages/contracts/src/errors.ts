import { z } from "zod";

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),

    fields: z
      .record(z.string(), z.array(z.string()))
      .optional(),

    requestId: z.string().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
