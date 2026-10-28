import { bridgeConfigSchema } from "@home-assistant-matter-hub/common";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FormEditor } from "./FormEditor.tsx";

afterEach(cleanup);
it("does not silently enable an empty location scope when editing a legacy hub", async () => {
  const change = vi.fn();
  render(
    <FormEditor
      omitOptionalDefaults
      value={{
        name: "Home",
        port: 5540,
        filter: { include: [], exclude: [] },
        featureFlags: { stableIdentity: true },
      }}
      schema={bridgeConfigSchema}
      onChange={change}
    />,
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: /^name/i }),
    " updated",
  );
  expect(change).toHaveBeenCalled();
  const data = change.mock.calls[change.mock.calls.length - 1][0];
  expect(data.filter).not.toHaveProperty("location");
  expect(data.featureFlags.stableIdentity).toBe(true);
});
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
