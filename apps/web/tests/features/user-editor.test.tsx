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
  usersQuerySchema,
} from "@crud/contracts/users";

import { ApiError } from "@/lib/api-error";

import {
  createUser,
  type User,
} from "@/features/users/user.api";

import {
  UserEditor,
} from "@/features/users/user-editor";

import {
  userKeys,
} from "@/features/users/user.queries";

import {
  renderWithQuery,
} from "../helpers/render-query";

vi.mock("@/features/users/user.api", () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
}));

const savedUser: User = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Didin Rudini",
  email: "didin@example.com",
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("UserEditor", () => {
  test("saves normalized input and invalidates list cache", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();

    vi.mocked(createUser).mockResolvedValue(
      savedUser,
    );

    const { queryClient } = renderWithQuery(
      <UserEditor
        user={null}
        onDone={onDone}
      />,
    );

    const params = usersQuerySchema.parse({});
    const queryKey = userKeys.list(params);

    queryClient.setQueryData(queryKey, {
      data: [],
      meta: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });

    await user.type(
      screen.getByLabelText("Nama"),
      "  Didin Rudini  ",
    );

    await user.type(
      screen.getByLabelText("Email"),
      "DIDIN@EXAMPLE.COM",
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Simpan",
        }),
      ).toBeEnabled();
    });

    await user.click(
      screen.getByRole("button", {
        name: "Simpan",
      }),
    );

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        name: "Didin Rudini",
        email: "didin@example.com",
      });

      expect(onDone).toHaveBeenCalledTimes(1);

      expect(
        queryClient.getQueryState(queryKey)
          ?.isInvalidated,
      ).toBe(true);
    });
  });

  test("preserves values after conflict and allows correction", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();

    vi.mocked(createUser)
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email sudah digunakan",
          fields: {
            email: ["Email sudah digunakan"],
          },
          requestId: "test-request-1",
        }),
      )
      .mockResolvedValueOnce({
        ...savedUser,
        email: "baru@example.com",
      });

    renderWithQuery(
      <UserEditor
        user={null}
        onDone={onDone}
      />,
    );

    const nameInput =
      screen.getByLabelText("Nama");

    const emailInput =
      screen.getByLabelText("Email");

    await user.type(nameInput, "Didin Rudini");
    await user.type(
      emailInput,
      "didin@example.com",
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Simpan",
        }),
      ).toBeEnabled();
    });

    await user.click(
      screen.getByRole("button", {
        name: "Simpan",
      }),
    );

    expect(
      await screen.findByText(
        "Email sudah digunakan",
      ),
    ).toBeInTheDocument();

    expect(nameInput).toHaveValue(
      "Didin Rudini",
    );

    expect(emailInput).toHaveValue(
      "didin@example.com",
    );

    expect(emailInput).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    expect(onDone).not.toHaveBeenCalled();

    await user.clear(emailInput);
    await user.type(
      emailInput,
      "baru@example.com",
    );

    expect(
      screen.queryByText(
        "Email sudah digunakan",
      ),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Simpan",
        }),
      ).toBeEnabled();
    });

    await user.click(
      screen.getByRole("button", {
        name: "Simpan",
      }),
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    expect(createUser).toHaveBeenLastCalledWith({
      name: "Didin Rudini",
      email: "baru@example.com",
    });
  });
});