import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  userIdSchema,
  userInputSchema,
} from "@crud/contracts/users";
import { userRepository } from "./user.repository";

const notFound = {
  error: {
    code: "USER_NOT_FOUND",
    message: "Penggguna tidak ditemukan",
  },
} as const;

export const userRoutes = new Hono()
  .get("/", async (c) => {
    const data = await userRepository.list();
    return c.json({ data }, 200);
  })
  .get("/:id", zValidator("param", userIdSchema), async (c) => {
    const {id} = c.req.valid("param");
    const user = await userRepository.findById(id);

    if (!user) return c.json(notFound, 404);

    return c.json(user, 200);
  })
  .post("/", zValidator("json", userInputSchema), async (c) => {
    const input = c.req.valid("json");
    const user = await userRepository.create(input);

    return c.json({ data: user }, 201);
  })
  .put("/:id",
    zValidator("param", userIdSchema),
    zValidator("json", userInputSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = await userRepository.update(id, input);

      if (!user) return c.json(notFound, 404);

      return c.json({ data: user }, 200);
    }
)
  .delete("/:id", zValidator("param", userIdSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = await userRepository.delete(id);

    if (!user) return c.json(notFound, 404);

    return c.json({ data: user }, 200);
})
