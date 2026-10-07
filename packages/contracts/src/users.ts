import { z } from "zod";

export const userInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export const userIdSchema = z.object({
  id: z.uuid(),
});

export const pageSizeSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(50),
  z.literal(100),
]);

export const userSortBySchema = z.enum([
  "createdAt",
  "name",
  "email",
]);

export const sortOrderSchema = z.enum(["asc", "desc"]);

export const usersQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(1),
  
  pageSize: z.coerce
    .number()
    .pipe(pageSizeSchema)
    .default(10),
  
  search: z.string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),

  sortBy: userSortBySchema.default("createdAt"),

  sortOrder: sortOrderSchema.default("desc"),
})

export type UserInput = z.infer<typeof userInputSchema>;

export type PageSize = z.infer<typeof pageSizeSchema>;

export type UserSortBy = z.infer<typeof userSortBySchema>;

export type SortOrder = z.infer<typeof sortOrderSchema>;

export type UsersQueryParams = z.infer<typeof usersQuerySchema>;
