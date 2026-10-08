import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  userIdSchema,
  userInputSchema,
  usersQuerySchema,
} from "@crud/contracts/users";

import {
  apiError,
  validationHook,
} from "../../lib/api-error";

import { userRepository } from "./user.repository";

import {
  requireAdmin,
  requireAuth,
  type AuthEnv,
} from "../auth/auth.middleware";

export const userRoutes = new Hono<AuthEnv>()
  .use("*", requireAuth)
  .get(
    "/",
    zValidator(
      "query",
      usersQuerySchema,
      validationHook,
    ),
    async (c) => {
      const params = c.req.valid("query");
      const result = await userRepository.list(params);

      return c.json(result, 200);
    },
  )
  .get(
    "/:id",
    zValidator(
      "param",
      userIdSchema,
      validationHook,
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = await userRepository.findById(id);

      if (!user) {
        return apiError(c, 404, {
          code: "USER_NOT_FOUND",
          message: "Pengguna tidak ditemukan",
        });
      }

      return c.json({ data: user }, 200);
    }
  )
  .post(
    "/",
    requireAdmin,
    zValidator(
      "json",
      userInputSchema,
      validationHook,
    ),
    async (c) => {
      const input = c.req.valid("json");
      const user = await userRepository.create(input);

      return c.json({ data: user }, 201);
    },
  )
  .put(
    "/:id",
    requireAdmin,
    zValidator(
      "param",
      userIdSchema,
      validationHook,
    ),
    zValidator(
      "json",
      userInputSchema,
      validationHook,
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      const user = await userRepository.update(
        id,
        input,
      );

      if (!user) {
        return apiError(c, 404, {
          code: "USER_NOT_FOUND",
          message: "Pengguna tidak ditemukan",
        });
      }

      return c.json({ data: user }, 200)
    }
  )
  .delete(
    "/:id",
    requireAdmin,
    zValidator(
      "param",
      userIdSchema,
      validationHook,
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = await userRepository.delete(id);

      if (!user) {
        return apiError(c, 404, {
          code: "USER_NOT_FOUND",
          message: "Pengguna tidak ditemukan",
        });
      }

      return c.json({ data: user }, 200);
    },
  );
