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
import { createHash } from "node:crypto";
import { like, inArray, eq } from "drizzle-orm";
import { z } from "zod";

import {
  accountSchema,
  type AccountRole,
} from "@crud/contracts/auth";

import {
  apiErrorResponseSchema,
} from "@crud/contracts/errors";

import { app } from "../../src/app";
import { db, sql } from "../../src/db/client";

import {
  userRepository,
} from "../../src/modules/users/user.repository";

import {
  assertTestEnvironment,
} from "../helpers/test-env";

import { env } from "../../src/config/env";

import {
  accounts,
  loginAttempts,
  sessions,
  users
} from "../../src/db/schema";

import {
  cleanupExpiredAuthData,
} from "../../src/modules/auth/auth.maintenance";


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

describe("Users API integration", () => {
  const domain = `suite-${crypto.randomUUID()}.example.test`;

  const allowedTestOrigin = env.APP_ORIGINS[0];
  
  if (!allowedTestOrigin) {
    throw new Error("APP_ORIGINS harus berisi minimal satu origin");
  }

  // Normalisasi sekali dan gunakan untuk seluruh request tes.
  const origin = new URL(allowedTestOrigin).origin;

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
    headers.set("Origin", origin);
  
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

  const authTestPassword = "Only-for-auth-tests-2026!";
  
  function testOrigin() {
    return origin;
  }
  
  async function createAuthAccount(role: AccountRole = "admin") {
    const email = `auth-${crypto.randomUUID()}@${domain}`;
  
    const passwordHash = await Bun.password.hash(authTestPassword, {
      algorithm: "argon2id",
    });
  
    const [row] = await db
      .insert(accounts)
      .values({
        name: `Test ${role}`,
        email,
        passwordHash,
        role,
      })
      .returning({
        id: accounts.id,
        name: accounts.name,
        email: accounts.email,
        role: accounts.role,
      });
  
    if (!row) {
      throw new Error("Gagal membuat akun tes");
    }
  
    return accountSchema.parse(row);
  }
  
  function requestWithCookie(
    path: string,
    cookie: string,
    init: RequestInit = {},
  ) {
    const headers = new Headers(init.headers);
  
    headers.set("Cookie", cookie);
    headers.set("Origin", testOrigin());
  
    return app.request(path, {
      ...init,
      headers,
    });
  }
  
  function loginRequest(
    email: string,
    password: string,
    previousCookie?: string,
  ) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Origin: testOrigin(),
    });
  
    if (previousCookie) {
      headers.set("Cookie", previousCookie);
    }
  
    return app.request("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });
  }
  
  async function loginAccount(email: string) {
    const response = await loginRequest(email, authTestPassword);
  
    expect(response.status).toBe(200);
  
    const setCookie = response.headers.get("set-cookie");
  
    if (!setCookie) {
      throw new Error("Respons login tidak mengandung cookie session");
    }
  
    // Header Cookie hanya membawa nama dan nilai cookie.
    const cookie = setCookie.split(";")[0];
  
    if (!cookie) {
      throw new Error("Cookie session tidak valid");
    }
  
    return { response, cookie, setCookie };
  }
  
  function sessionHashFromCookie(cookie: string) {
    const separator = cookie.indexOf("=");
  
    if (separator < 0) {
      throw new Error("Format cookie tidak valid");
    }
  
    const token = cookie.slice(separator + 1);
  
    return createHash("sha256").update(token).digest("hex");
  }
  
  async function expectAuthError(
    response: Response,
    status: number,
    code: string,
  ) {
    expect(response.status).toBe(status);
  
    const body = apiErrorResponseSchema.parse(await response.json());
  
    expect(body.error.code).toBe(code);
  
    return body.error;
  }
  
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
          Origin: origin,
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

  test(
    "maintenance menghapus data kedaluwarsa dan mempertahankan data aktif",
    async () => {
      const account = await createAuthAccount();
  
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60_000);
      const activeUntil = new Date(now.getTime() + 3_600_000);
  
      function uniqueHash() {
        return createHash("sha256")
          .update(crypto.randomUUID())
          .digest("hex");
      }
  
      const expiredSessionHash = uniqueHash();
      const activeSessionHash = uniqueHash();
  
      const expiredAttemptKey = uniqueHash();
      const activeAttemptKey = uniqueHash();
  
      try {
        await db.insert(sessions).values([
          {
            tokenHash: expiredSessionHash,
            accountId: account.id,
            expiresAt: expiredAt,
          },
          {
            tokenHash: activeSessionHash,
            accountId: account.id,
            expiresAt: activeUntil,
          },
        ]);
  
        await db.insert(loginAttempts).values([
          {
            key: expiredAttemptKey,
            attempts: 5,
            expiresAt: expiredAt,
          },
          {
            key: activeAttemptKey,
            attempts: 3,
            expiresAt: activeUntil,
          },
        ]);
  
        await cleanupExpiredAuthData(now);
  
        const remainingSessions = await db
          .select({ tokenHash: sessions.tokenHash })
          .from(sessions)
          .where(
            inArray(sessions.tokenHash, [
              expiredSessionHash,
              activeSessionHash,
            ]),
          );
  
        expect(remainingSessions).toEqual([
          { tokenHash: activeSessionHash },
        ]);
  
        const remainingAttempts = await db
          .select({
            key: loginAttempts.key,
            attempts: loginAttempts.attempts,
          })
          .from(loginAttempts)
          .where(
            inArray(loginAttempts.key, [
              expiredAttemptKey,
              activeAttemptKey,
            ]),
          );
  
        expect(remainingAttempts).toEqual([
          {
            key: activeAttemptKey,
            attempts: 3,
          },
        ]);
      } finally {
        await db
          .delete(loginAttempts)
          .where(
            inArray(loginAttempts.key, [
              expiredAttemptKey,
              activeAttemptKey,
            ]),
          );
  
        // Menghapus akun juga membersihkan session fixture
        // melalui foreign key ON DELETE CASCADE.
        await db
          .delete(accounts)
          .where(eq(accounts.id, account.id));
      }
    },
    15_000,
  );

  test(
    "login menolak password salah dan email yang tidak terdaftar",
    async () => {
      const account = await createAuthAccount();
  
      const wrongPasswordResponse = await loginRequest(
        account.email,
        "Wrong-password-2026!",
      );
  
      const unknownEmailResponse = await loginRequest(
        `unknown-${crypto.randomUUID()}@${domain}`,
        "Wrong-password-2026!",
      );
  
      const wrongPasswordError = await expectAuthError(
        wrongPasswordResponse,
        401,
        "INVALID_CREDENTIALS",
      );
  
      const unknownEmailError = await expectAuthError(
        unknownEmailResponse,
        401,
        "INVALID_CREDENTIALS",
      );
  
      expect(wrongPasswordError.message).toBe(unknownEmailError.message);
  
      expect(wrongPasswordResponse.headers.get("set-cookie")).toBeNull();
      expect(unknownEmailResponse.headers.get("set-cookie")).toBeNull();
    },
    15_000,
  );
  
  test(
    "login menerbitkan cookie dan me mengembalikan akun tanpa password",
    async () => {
      const account = await createAuthAccount();
  
      const { response, cookie, setCookie } = await loginAccount(
        account.email,
      );
  
      const loginBody = await response.json();
  
      expect(loginBody).toEqual({
        data: account,
      });
  
      expect(setCookie.toLowerCase()).toContain("httponly");
      expect(setCookie.toLowerCase()).toContain("samesite=lax");
      expect(setCookie.toLowerCase()).toContain("path=/");
  
      const meResponse = await requestWithCookie("/api/auth/me", cookie);
  
      expect(meResponse.status).toBe(200);
      expect(await meResponse.json()).toEqual({
        data: account,
      });
  
      const storedSessions = await db
        .select({ tokenHash: sessions.tokenHash })
        .from(sessions)
        .where(eq(sessions.tokenHash, sessionHashFromCookie(cookie)));
  
      expect(storedSessions).toHaveLength(1);
    },
    15_000,
  );

  test(
    "logout menghapus session dan menolak penggunaan cookie lama",
    async () => {
      const account = await createAuthAccount();
      const { cookie } = await loginAccount(account.email);
  
      const logoutResponse = await requestWithCookie(
        "/api/auth/logout",
        cookie,
        { method: "POST" },
      );
  
      expect(logoutResponse.status).toBe(200);
      expect(await logoutResponse.json()).toEqual({
        data: { success: true },
      });
  
      expect(logoutResponse.headers.get("set-cookie")).not.toBeNull();
  
      const storedSessions = await db
        .select({ tokenHash: sessions.tokenHash })
        .from(sessions)
        .where(eq(sessions.tokenHash, sessionHashFromCookie(cookie)));
  
      expect(storedSessions).toHaveLength(0);
  
      // Sengaja kirim ulang cookie lama untuk membuktikan
      // bahwa session juga dicabut di server.
      const meResponse = await requestWithCookie("/api/auth/me", cookie);
  
      expect(meResponse.status).toBe(200);
      expect(await meResponse.json()).toEqual({ data: null });
  
      const usersResponse = await requestWithCookie("/api/users", cookie);
  
      await expectAuthError(
        usersResponse,
        401,
        "UNAUTHENTICATED",
      );
    },
    15_000,
  );
  
  test(
    "session kedaluwarsa tidak dapat mengakses endpoint terlindungi",
    async () => {
      const account = await createAuthAccount();
      const { cookie } = await loginAccount(account.email);
  
      // Atur session milik tes ini menjadi sudah kedaluwarsa.
      // Session admin yang dipakai tes CRUD lain tidak disentuh.
      await db
        .update(sessions)
        .set({
          expiresAt: new Date(Date.now() - 60_000),
        })
        .where(eq(sessions.tokenHash, sessionHashFromCookie(cookie)));
  
      const meResponse = await requestWithCookie("/api/auth/me", cookie);
  
      expect(meResponse.status).toBe(200);
      expect(await meResponse.json()).toEqual({ data: null });
  
      const usersResponse = await requestWithCookie("/api/users", cookie);
  
      await expectAuthError(
        usersResponse,
        401,
        "UNAUTHENTICATED",
      );
    },
    15_000,
  );

  test(
    "viewer dapat membaca tetapi tidak dapat membuat, mengubah, atau menghapus",
    async () => {
      const viewer = await createAuthAccount("viewer");
      const { cookie } = await loginAccount(viewer.email);
  
      const [target] = await db
        .insert(users)
        .values({
          name: "Authorization Target",
          email: `target-${crypto.randomUUID()}@${domain}`,
        })
        .returning();
  
      if (!target) {
        throw new Error("Gagal membuat target tes");
      }
  
      const listResponse = await requestWithCookie("/api/users", cookie);
  
      expect(listResponse.status).toBe(200);
  
      const detailResponse = await requestWithCookie(
        `/api/users/${target.id}`,
        cookie,
      );
  
      expect(detailResponse.status).toBe(200);
  
      const rejectedEmail = `rejected-${crypto.randomUUID()}@${domain}`;
  
      const createResponse = await requestWithCookie(
        "/api/users",
        cookie,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Unauthorized Create",
            email: rejectedEmail,
          }),
        },
      );
  
      const updateResponse = await requestWithCookie(
        `/api/users/${target.id}`,
        cookie,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Unauthorized Update",
            email: target.email,
          }),
        },
      );
  
      const deleteResponse = await requestWithCookie(
        `/api/users/${target.id}`,
        cookie,
        { method: "DELETE" },
      );
  
      for (const response of [
        createResponse,
        updateResponse,
        deleteResponse,
      ]) {
        await expectAuthError(response, 403, "FORBIDDEN");
      }
  
      const [unchanged] = await db
        .select()
        .from(users)
        .where(eq(users.id, target.id));
  
      expect(unchanged).toBeDefined();
      expect(unchanged?.name).toBe(target.name);
      expect(unchanged?.email).toBe(target.email);
  
      const rejectedRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, rejectedEmail));
  
      expect(rejectedRows).toHaveLength(0);
    },
    15_000,
  );

  test(
    "percobaan login keenam dalam satu window dibatasi",
    async () => {
      const account = await createAuthAccount();
  
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await loginRequest(
          account.email,
          "Wrong-password-2026!",
        );
  
        await expectAuthError(
          response,
          401,
          "INVALID_CREDENTIALS",
        );
      }
  
      const blockedResponse = await loginRequest(
        account.email,
        "Wrong-password-2026!",
      );
  
      await expectAuthError(
        blockedResponse,
        429,
        "TOO_MANY_LOGIN_ATTEMPTS",
      );
  
      const retryAfter = Number(
        blockedResponse.headers.get("retry-after"),
      );
  
      expect(Number.isFinite(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    },
    30_000,
  );

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