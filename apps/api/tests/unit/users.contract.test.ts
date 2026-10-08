import { describe, expect, test } from "bun:test";

import {
  userInputSchema,
  usersQuerySchema,
} from "@crud/contracts/users";

describe("userInputSchema", () => {
  test("normalizes valid input", () => {
    const result = userInputSchema.parse({
      name: "  Didin Rudini  ",
      email: "  DIDIN@EXAMPLE.COM  ",
    });

    expect(result).toEqual({
      name: "Didin Rudini",
      email: "didin@example.com",
    });
  });

  test("rejects a name containing only spaces", () => {
    const result = userInputSchema.safeParse({
      name: "   ",
      email: "didin@example.com",
    });

    expect(result.success).toBe(false);
  });

  test("rejects invalid email", () => {
    const result = userInputSchema.safeParse({
      name: "Didin Rudini",
      email: "bukan-email",
    });

    expect(result.success).toBe(false);
  });
});

describe("usersQuerySchema", () => {
  test("provides defaults when parameters are absent", () => {
    const result = usersQuerySchema.parse({});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.sortBy).toBe("createdAt");
    expect(result.sortOrder).toBe("desc");
    expect(result.search).toBeUndefined();
  });

  test("converts HTTP query strings into valid values", () => {
    const result = usersQuerySchema.parse({
      page: "2",
      pageSize: "20",
      search: "  didin  ",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result).toEqual({
      page: 2,
      pageSize: 20,
      search: "didin",
      sortBy: "name",
      sortOrder: "asc",
    });
  });

  test("treats an empty search as no search", () => {
    const result = usersQuerySchema.parse({
      search: "   ",
    });

    expect(result.search).toBeUndefined();
  });

  test.each([
    { page: "0" },
    { page: "-1" },
    { page: "1.5" },
    { page: "abc" },
    { pageSize: "15" },
    { sortBy: "password" },
    { sortOrder: "random" },
    { search: "a".repeat(101) },
  ])("rejects invalid parameters: %p", (input) => {
    const result = usersQuerySchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});