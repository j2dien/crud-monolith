import { hc } from "hono/client";
import type { AppType } from "@crud/api/app";

export const rpc = hc<AppType>(
  window.location.origin,
  {
    init: {
      credentials: "same-origin"
    },
  },
);
