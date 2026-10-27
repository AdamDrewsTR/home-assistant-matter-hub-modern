import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FormEditor } from "./FormEditor.tsx";

afterEach(cleanup);
it("distinguishes initial schema defaults from real edits for draft protection", async () => {
  const change = vi.fn();
  render(
    <FormEditor
      value={{}}
      schema={{
        type: "object",
        properties: {
          name: { type: "string", title: "Hub name", default: "My hub" },
        },
      }}
      onChange={change}
    />,
  );
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith({ name: "My hub" }, true, true),
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Hub name" }),
    " updated",
  );
  expect(change).toHaveBeenLastCalledWith(
    { name: "My hub updated" },
    true,
    false,
  );
});
