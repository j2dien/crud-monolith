import { z } from "zod";

export const userInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export const userIdSchema = z.object({
  id: z.uuid(),
});

export type UserInput = z.infer<typeof userInputSchema>;
