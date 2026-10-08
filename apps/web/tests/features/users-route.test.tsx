import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  deleteUser,
  listUsers,
  type User,
} from "@/features/users/user.api";
import {
  getCurrentAccount,
} from "@/features/auth/auth.api";

import {
  renderUsersRoute,
} from "../helpers/render-router";

vi.mock("@/features/auth/auth.api", () => ({
  getCurrentAccount: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/features/users/user.api", () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
}));

let availableUsers: User[];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentAccount)
    .mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Test Administrator",
      email: "admin@example.com",
      role: "admin",
    });

  availableUsers = Array.from(
    { length: 11 },
    (_, index) => {
      const number = String(index).padStart(
        2,
        "0",
      );

      return {
        id: crypto.randomUUID(),
        name: `Person ${number}`,
        email: `person${number}@example.com`,
        createdAt: "2026-10-08T00:00:00Z",
        updatedAt: "2026-10-08T00:00:00Z",
      };
    },
  );

  vi.mocked(listUsers).mockImplementation(
    async (params) => {
      const search =
        params.search?.toLowerCase();

      const filtered = availableUsers.filter(
        (user) =>
          !search ||
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search),
      );

      const offset =
        (params.page - 1) * params.pageSize;

      return {
        data: filtered.slice(
          offset,
          offset + params.pageSize,
        ),

        meta: {
          page: params.page,
          pageSize: params.pageSize,
          total: filtered.length,
          totalPages: Math.ceil(
            filtered.length / params.pageSize,
          ),
        },
      };
    },
  );

  vi.mocked(deleteUser).mockImplementation(
    async (id) => {
      availableUsers = availableUsers.filter(
        (user) => user.id !== id,
      );

      return { id };
    },
  );
});

describe("Users route", () => {
  test("stores search in URL and restores it on a fresh mount", async () => {
    const user = userEvent.setup();

    const view = await renderUsersRoute(
      "/?page=2&pageSize=10",
    );

    expect(
      await screen.findByText("Person 10"),
    ).toBeInTheDocument();

    const input = screen.getByLabelText(
      "Cari nama atau email",
    );

    await user.type(input, "Person 00");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        view.router.state.location.search,
      ).toMatchObject({
        page: 1,
        search: "Person 00",
      });

      expect(
        screen.getByText("Person 00"),
      ).toBeInTheDocument();

      expect(
        screen.queryByText("Person 10"),
      ).not.toBeInTheDocument();
    });

    const savedLocation =
      view.router.state.location.href;

    view.unmount();

    await renderUsersRoute(savedLocation);

    expect(
      await screen.findByText("Person 00"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        "Cari nama atau email",
      ),
    ).toHaveValue("Person 00");
  });

  test("returns to the previous page after deleting the last row", async () => {
    const user = userEvent.setup();

    vi.spyOn(window, "confirm")
      .mockReturnValue(true);

    const view = await renderUsersRoute(
      "/?page=2&pageSize=10",
    );

    expect(
      await screen.findByText("Person 10"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hapus" }),
    );

    await waitFor(() => {
      expect(
        view.router.state.location.search.page,
      ).toBe(1);

      expect(
        screen.getByText("Person 00"),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Halaman 1 dari 1 · Total 10 pengguna",
        ),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Berikutnya",
        }),
      ).toBeDisabled();
    });

    expect(deleteUser).toHaveBeenCalledTimes(1);
  });
});