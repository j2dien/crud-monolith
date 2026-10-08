import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Account } from "@crud/contracts/auth";

import {
  getCurrentAccount,
  login,
  logout,
} from "../../src/features/auth/auth.api";

import { listUsers } from "../../src/features/users/user.api";
import { ApiError } from "../../src/lib/api-error";
import { renderUsersRoute } from "../helpers/render-router";

vi.mock("../../src/features/auth/auth.api", () => ({
  getCurrentAccount: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../src/features/users/user.api", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

const admin: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Admin",
  email: "admin@example.test",
  role: "admin",
};

const viewer: Account = {
  ...admin,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test Viewer",
  email: "viewer@example.test",
  role: "viewer",
};

const exampleUser = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Example User",
  email: "user@example.test",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getCurrentAccount).mockResolvedValue(null);
  vi.mocked(logout).mockResolvedValue({ success: true });

  vi.mocked(listUsers).mockResolvedValue({
    data: [exampleUser],
    meta: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    },
  });
});

describe("autentikasi melalui route aplikasi", () => {
  it("pengunjung tanpa session diarahkan ke login", async () => {
    const { router } = await renderUsersRoute("/");

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(router.state.location.pathname).toBe("/login");
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("login salah menampilkan pesan dan mempertahankan input", async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(401, {
        code: "INVALID_CREDENTIALS",
        message: "Email atau password tidak benar",
      }),
    );

    const user = userEvent.setup();
    const { router } = await renderUsersRoute("/login");

    await user.type(
      screen.getByLabelText("Email"),
      "admin@example.test",
    );

    await user.type(
      screen.getByLabelText("Password"),
      "Wrong-password-2026!",
    );

    await user.click(
      screen.getByRole("button", { name: "Masuk" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Email atau password tidak benar");

    expect(router.state.location.pathname).toBe("/login");

    expect(screen.getByLabelText("Email")).toHaveValue(
      "admin@example.test",
    );

    expect(screen.getByLabelText("Password")).toHaveValue(
      "Wrong-password-2026!",
    );

    expect(listUsers).not.toHaveBeenCalled();
  });

  it("login berhasil membuka halaman pengguna", async () => {
    vi.mocked(login).mockImplementation(async () => {
      // Permintaan me berikutnya kini mengenali session.
      vi.mocked(getCurrentAccount).mockResolvedValue(admin);

      return admin;
    });

    const user = userEvent.setup();
    const { router } = await renderUsersRoute("/login");

    await user.type(
      screen.getByLabelText("Email"),
      "ADMIN@example.test",
    );

    await user.type(
      screen.getByLabelText("Password"),
      "Only-for-auth-tests-2026!",
    );

    await user.click(
      screen.getByRole("button", { name: "Masuk" }),
    );

    expect(
      await screen.findByText("Example User"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });

    expect(vi.mocked(login).mock.calls[0]?.[0]).toEqual({
      email: "admin@example.test",
      password: "Only-for-auth-tests-2026!",
    });

    expect(
      screen.getByRole("button", { name: "Keluar" }),
    ).toBeInTheDocument();
  });

  it("logout kembali ke login dan menghapus cache privat", async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(admin);

    vi.mocked(logout).mockImplementation(async () => {
      vi.mocked(getCurrentAccount).mockResolvedValue(null);

      return { success: true };
    });

    const user = userEvent.setup();

    const { router, queryClient } = await renderUsersRoute("/");

    await screen.findByText("Example User");

    const privateKey = ["private-auth-test"];

    queryClient.setQueryData(privateKey, {
      secret: "data dari session sebelumnya",
    });

    await user.click(
      screen.getByRole("button", { name: "Keluar" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(queryClient.getQueryData(privateKey)).toBeUndefined();
    });

    // Membuka dashboard lagi tetap membutuhkan session.
    await act(async () => {
      await router.navigate({
        to: "/",
        search: {
          page: 1,
          pageSize: 10,
          search: undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });

  it("viewer dapat membaca tanpa kontrol mutasi", async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(viewer);

    await renderUsersRoute("/");

    expect(
      await screen.findByText("Example User"),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Tambah pengguna" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Hapus" }),
    ).not.toBeInTheDocument();
  });

  it("session tidak valid pada pemeriksaan ulang kembali ke login", async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(admin);

    const { router, queryClient } = await renderUsersRoute("/");

    await screen.findByText("Example User");

    const privateKey = ["private-expired-session-test"];

    queryClient.setQueryData(privateKey, {
      secret: "cache session yang sudah kedaluwarsa",
    });

    vi.mocked(getCurrentAccount).mockResolvedValue(null);

    await act(async () => {
      await router.invalidate();
    });

    expect(
      await screen.findByRole("heading", { name: "Login" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
      expect(queryClient.getQueryData(privateKey)).toBeUndefined();
    });
  });
});
