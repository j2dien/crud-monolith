import "@testing-library/jest-dom/vitest";

import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

import {
  disposeTestQueryClients,
} from "./helpers/render-query";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
  disposeTestQueryClients();
});