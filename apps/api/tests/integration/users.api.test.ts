import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";

import { like } from "drizzle-orm";
import { z } from "zod";

import {
  apiErrorResponseSchema,
} from "@crud/contracts/errors";

import { app } from "../../src/app";
import { db, sql } from "../../src/db/client";
import { users } from "../../src/db/schema";

import {
  userRepository,
} from "../../src/modules/users/user.repository";

import {
  assertTestEnvironment,
} from "../helpers/test-env";

import { env } from "../../src/config/env";

import {
  accounts,
} from "../../src/db/schema";

const domain =
  `suite-${crypto.randomUUID()}.example.test`;

const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const userResponseSchema = z.object({
  data: userSchema,
});

const listResponseSchema = z.object({
  data: z.array(userSchema),

  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

async function cleanupFixtures() {
  assertTestEnvironment();

  // Hanya hapus data dengan penanda suite ini.
  await db
    .delete(users)
    .where(
      like(users.email, `%@${domain}`),
    );
}

const testPassword =
  "Only-for-local-tests-2026!";

let authCookie = "";

function authenticatedRequest(
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);

  headers.set("Cookie", authCookie);
  headers.set("Origin", env.APP_ORIGIN);

  return app.request(path, {
    ...init,
    headers,
  });
}

function jsonRequest(
  path: string,
  method: "POST" | "PUT",
  input: unknown,
) {
  return authenticatedRequest(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

function listRequest(
  page: number,
  sortOrder: "asc" | "desc" = "asc",
  search: string = domain,
) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: "10",
    search,
    sortBy: "name",
    sortOrder,
  });

  return authenticatedRequest(`/api/users?${query}`);
}

async function readError(
  response: Response,
  expectedStatus: number,
) {
  expect(response.status).toBe(expectedStatus);

  const body = apiErrorResponseSchema.parse(
    await response.json(),
  );

  expect(body.error.requestId).toBeTruthy();

  expect(body.error.requestId).toBe(
    response.headers.get("x-request-id") ?? undefined,
  );

  return body.error;
}

describe("Users API integration", () => {
  beforeAll(async () => {
    assertTestEnvironment();

    const [row] = await sql`
      select current_database() as database_name
    `;

    expect(row?.database_name).toBe(
      "crud_app_test",
    );

    await db.insert(accounts).values({
      name: "Test Administrator",
      email: `admin@${domain}`,
      passwordHash: await Bun.password.hash(
        testPassword,
        { algorithm: "argon2id" },
      ),
      role: "admin",
    });

    const response = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: env.APP_ORIGIN,
        },
        body: JSON.stringify({
          email: `admin@${domain}`,
          password: testPassword,
        }),
      },
    );

    expect(response.status).toBe(200);

    const cookie = response.headers.get(
      "set-cookie",
    );

    if (!cookie) {
      throw new Error(
        "Login did not return a session cookie",
      );
    }
    
    authCookie = cookie.split(";")[0]!;
  });

  beforeEach(async () => {
    await cleanupFixtures();

    await db.insert(users).values(
      Array.from({ length: 12 }, (_, index) => {
        const number = String(index).padStart(
          2,
          "0",
        );

        return {
          name: `Person ${number}`,
          email: `person${number}@${domain}`,
        };
      }),
    );
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    try {
      await cleanupFixtures();

      await db
        .delete(accounts)
        .where(
          like(accounts.email, `%@${domain}`),
        );
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  test("rejects anonymous access", async () => {
    const response = await app.request(
      "/api/users",
    );
  
    const error = await readError(
      response,
      401,
    );
  
    expect(error.code).toBe(
      "UNAUTHENTICATED",
    );
  });

  test("rejects mutation from an untrusted origin", async () => {
    const response = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
          Origin: "https://other.example",
        },
        body: JSON.stringify({
          name: "Example User",
          email: `blocked@${domain}`,
        }),
      },
    );
  
    const error = await readError(
      response,
      403,
    );
  
    expect(error.code).toBe(
      "INVALID_ORIGIN",
    );
  });

  test("creates, reads, updates, and deletes a user", async () => {
    const createdResponse = await jsonRequest(
      "/api/users",
      "POST",
      {
        name: "  New User  ",
        email: `NEW@${domain.toUpperCase()}`,
      },
    );

    expect(createdResponse.status).toBe(201);

    const created = userResponseSchema.parse(
      await createdResponse.json(),
    ).data;

    expect(created.name).toBe("New User");
    expect(created.email).toBe(`new@${domain}`);

    const detailResponse = await authenticatedRequest(
      `/api/users/${created.id}`,
    );

    expect(detailResponse.status).toBe(200);

    const detail = userResponseSchema.parse(
      await detailResponse.json(),
    ).data;

    expect(detail.id).toBe(created.id);

    const updateResponse = await jsonRequest(
      `/api/users/${created.id}`,
      "PUT",
      {
        name: "Updated User",
        email: `updated@${domain}`,
      },
    );

    expect(updateResponse.status).toBe(200);

    const updated = userResponseSchema.parse(
      await updateResponse.json(),
    ).data;

    expect(updated.name).toBe("Updated User");
    expect(updated.email).toBe(
      `updated@${domain}`,
    );

    // Baca kembali untuk memastikan perubahan tersimpan.
    const rereadResponse = await authenticatedRequest(
      `/api/users/${created.id}`,
    );

    expect(rereadResponse.status).toBe(200);

    const reread = userResponseSchema.parse(
      await rereadResponse.json(),
    ).data;

    expect(reread.name).toBe("Updated User");

    const deleteResponse = await authenticatedRequest(
      `/api/users/${created.id}`,
      { method: "DELETE" },
    );

    expect(deleteResponse.status).toBe(200);

    const missingResponse = await authenticatedRequest(
      `/api/users/${created.id}`,
    );

    const error = await readError(
      missingResponse,
      404,
    );

    expect(error.code).toBe("USER_NOT_FOUND");
  });

  test("returns a field error for duplicate email", async () => {
    const response = await jsonRequest(
      "/api/users",
      "POST",
      {
        name: "Duplicate User",
        email: `person00@${domain}`,
      },
    );

    const error = await readError(response, 409);

    expect(error.code).toBe(
      "EMAIL_ALREADY_EXISTS",
    );

    expect(error.fields?.email).toEqual([
      "Email sudah digunakan",
    ]);
  });

  test("rejects an update using another user's email", async () => {
    const [target] = await db
      .select()
      .from(users)
      .where(
        like(users.email, `person01@${domain}`),
      );

    if (!target) {
      throw new Error("Fixture is missing");
    }

    const response = await jsonRequest(
      `/api/users/${target.id}`,
      "PUT",
      {
        name: "Changed Name",
        email: `person00@${domain}`,
      },
    );

    const error = await readError(response, 409);

    expect(error.code).toBe(
      "EMAIL_ALREADY_EXISTS",
    );

    const rereadResponse = await authenticatedRequest(
      `/api/users/${target.id}`,
    );

    const reread = userResponseSchema.parse(
      await rereadResponse.json(),
    ).data;

    expect(reread.name).toBe("Person 01");

    expect(reread.email).toBe(
      `person01@${domain}`,
    );
  });

  test("paginates without overlapping rows", async () => {
    const firstResponse = await listRequest(1);
    const secondResponse = await listRequest(2);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const first = listResponseSchema.parse(
      await firstResponse.json(),
    );

    const second = listResponseSchema.parse(
      await secondResponse.json(),
    );

    expect(first.meta).toEqual({
      page: 1,
      pageSize: 10,
      total: 12,
      totalPages: 2,
    });

    expect(first.data).toHaveLength(10);
    expect(second.data).toHaveLength(2);

    expect(first.data[0]?.name).toBe(
      "Person 00",
    );

    expect(second.data[0]?.name).toBe(
      "Person 10",
    );

    const firstIds = new Set(
      first.data.map((user) => user.id),
    );

    expect(
      second.data.some((user) =>
        firstIds.has(user.id),
      ),
    ).toBe(false);
  });

  test("sorts in descending order", async () => {
    const response = await listRequest(
      1,
      "desc",
    );

    expect(response.status).toBe(200);

    const result = listResponseSchema.parse(
      await response.json(),
    );

    expect(result.data[0]?.name).toBe(
      "Person 11",
    );
  });

  test("searches email without case sensitivity", async () => {
    const response = await listRequest(
      1,
      "asc",
      `PERSON01@${domain.toUpperCase()}`,
    );

    expect(response.status).toBe(200);

    const result = listResponseSchema.parse(
      await response.json(),
    );

    expect(result.meta.total).toBe(1);

    expect(result.data[0]?.email).toBe(
      `person01@${domain}`,
    );
  });

  test("returns zero totals for an unmatched search", async () => {
    const response = await listRequest(
      1,
      "asc",
      `missing-${crypto.randomUUID()}`,
    );

    expect(response.status).toBe(200);

    const result = listResponseSchema.parse(
      await response.json(),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
  });

  test("returns an empty list for a page beyond the last page", async () => {
    const response = await listRequest(3);

    expect(response.status).toBe(200);

    const result = listResponseSchema.parse(
      await response.json(),
    );

    expect(result.data).toEqual([]);
    expect(result.meta.page).toBe(3);
    expect(result.meta.total).toBe(12);
    expect(result.meta.totalPages).toBe(2);
  });

  test("rejects invalid query parameters", async () => {
    const response = await authenticatedRequest(
      "/api/users?pageSize=15",
    );

    const error = await readError(response, 400);

    expect(error.code).toBe(
      "VALIDATION_ERROR",
    );

    expect(
      error.fields?.pageSize?.length,
    ).toBeGreaterThan(0);
  });

  test("returns a standard error for malformed JSON", async () => {
    const response = await authenticatedRequest(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"name":',
      },
    );

    const error = await readError(response, 400);

    expect(error.code).toBe("BAD_REQUEST");
  });

  test("does not expose internal error details", async () => {
    const internalMessage =
      "PRIVATE_DATABASE_ERROR_SENTINEL";

    const spy = spyOn(
      userRepository,
      "list",
    ).mockImplementation(async () => {
      throw new Error(internalMessage);
    });

    try {
      const response = await listRequest(1);

      const error = await readError(
        response,
        500,
      );

      expect(error.code).toBe(
        "INTERNAL_ERROR",
      );

      expect(error.message).toBe(
        "Terjadi kesalahan pada server",
      );

      expect(JSON.stringify(error)).not.toContain(
        internalMessage,
      );
    } finally {
      spy.mockRestore();
    }
  });
});