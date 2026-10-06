import { z } from "zod";
import type { InferResponseType } from "hono/client";
import type { UserInput } from "@crud/contracts/users";
import { rpc } from "@/lib/rpc";

export type user = InferResponseType<typeof rpc.api.users.$get, 200>["data"][number];

const errorSchema = z.object({
  error: z.object({
    message: z.string(),
  })
})

async function throwApiError(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorSchema.safeParse(body);

  throw new Error(
    parsed.success
      ? parsed.data.error.message
      : `Request gagal (${response.status})`
  )
}
