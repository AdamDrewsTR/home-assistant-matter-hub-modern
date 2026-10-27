import { ThemeProvider } from "@mui/material/styles";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appTheme } from "../../theme/theme.ts";
import { CreateHubPage } from "./CreateHubPage.tsx";

const create = vi.fn();
vi.mock("../../hooks/data/bridges.ts", () => ({
  useCreateBridge: () => create,
  useUsedPorts: () => ({}),
}));
vi.mock("../../routes.tsx", () => ({
  navigation: { advancedSetup: "/setup?advanced=true" },
}));
vi.mock("./EntityPicker.tsx", () => ({
  EntityPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["light.desk"])}>
      Select desk lamp
    </button>
  ),
}));
vi.mock("../../components/bridge/BridgeTemplateSelector.tsx", () => ({
  BridgeTemplateSelector: () => null,
}));
vi.mock("../../components/bridge/BridgeConfigEditor.tsx", () => ({
  BridgeConfigEditor: ({
    onSave,
  }: {
    onSave: (config: { name: string }) => void;
  }) => (
    <button type="button" onClick={() => onSave({ name: "Advanced home" })}>
      Create advanced hub
    </button>
  ),
}));

function renderSetup(advanced = false) {
  const router = createMemoryRouter(
    [
      { path: "/setup", element: <CreateHubPage /> },
      { path: "/", element: <div>Pairing</div> },
    ],
    {
      initialEntries: [
        "/?from=before-setup",
        advanced ? "/setup?advanced=true" : "/setup",
      ],
    },
  );
  render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

beforeEach(() => create.mockReset());
afterEach(cleanup);

describe("simple hub setup", () => {
  it("creates an explicitly selected hub with the controller profile and no manual port", async () => {
    create.mockResolvedValue({ id: "new-hub" });
    const router = renderSetup();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Select desk lamp" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Create hub and pair" }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe("?hub=new-hub&view=pair"),
    );
    expect(create).toHaveBeenCalledWith({
      name: "My home",
      filter: {
        include: [{ type: "pattern", value: "light.desk" }],
        exclude: [],
      },
      featureFlags: expect.objectContaining({
        autoForceSync: true,
        coverUseHomeAssistantPercentage: true,
      }),
    });
    expect(create.mock.calls[0][0]).not.toHaveProperty("port");
    await act(() => router.navigate(-1));
    expect(router.state.location.search).toBe("?from=before-setup");
  });

  it("replaces advanced setup on completion instead of reopening it with Back", async () => {
    create.mockResolvedValue({ id: "advanced-hub" });
    const router = renderSetup(true);
    await userEvent.click(
      await screen.findByRole("button", { name: "Create advanced hub" }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe("?hub=advanced-hub&view=pair"),
    );
    await act(() => router.navigate(-1));
    expect(router.state.location.search).toBe("?from=before-setup");
  });
  it("stays on review with the selection intact when creation fails", async () => {
    create.mockRejectedValueOnce(new Error("Port unavailable"));
    renderSetup();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Select desk lamp" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Create hub and pair" }),
    );
    expect(await screen.findByText("Port unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create hub and pair" }),
    ).toBeEnabled();
    expect(screen.getByText("1 entity selected")).toBeInTheDocument();
  });
});
