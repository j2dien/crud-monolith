import {
  defineConfig,
  mergeConfig,
} from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,

  defineConfig({
    test: {
      environment: "jsdom",

      environmentOptions: {
        jsdom: {
          url: "http://localhost:5173",
        },
      },

      setupFiles: ["./tests/setup.ts"],

      include: [
        "tests/**/*.test.ts",
        "tests/**/*.test.tsx",
      ],

      clearMocks: true,
      restoreMocks: true,
    },
  }),
);