import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  usersQuerySchema,
} from "@crud/contracts/users";

import {
  UsersToolbar,
} from "@/features/users/users-toolbar";

describe("UsersToolbar", () => {
  test("submits trimmed search and resets the page", async () => {
    const user = userEvent.setup();

    const onParamsChange = vi.fn(
      async () => {},
    );

    render(
      <UsersToolbar
        params={usersQuerySchema.parse({
          page: 3,
        })}
        onParamsChange={onParamsChange}
      />,
    );

    const input = screen.getByLabelText(
      "Cari nama atau email",
    );

    await user.type(input, "  didin  ");

    expect(onParamsChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onParamsChange).toHaveBeenCalledWith({
      page: 1,
      search: "didin",
    });

    expect(input).toHaveFocus();
  });

  test("follows external URL changes and clears search", async () => {
    const user = userEvent.setup();

    const onParamsChange = vi.fn(
      async () => {},
    );

    const view = render(
      <UsersToolbar
        params={usersQuerySchema.parse({
          search: "didin",
        })}
        onParamsChange={onParamsChange}
      />,
    );

    const input = screen.getByLabelText(
      "Cari nama atau email",
    );

    await user.type(input, " tambahan");

    view.rerender(
      <UsersToolbar
        params={usersQuerySchema.parse({
          search: "budi",
        })}
        onParamsChange={onParamsChange}
      />,
    );

    expect(input).toHaveValue("budi");

    await user.click(
      screen.getByRole("button", {
        name: "Hapus pencarian",
      }),
    );

    expect(input).toHaveValue("");

    expect(onParamsChange).toHaveBeenCalledWith({
      page: 1,
      search: undefined,
    });
  });
});