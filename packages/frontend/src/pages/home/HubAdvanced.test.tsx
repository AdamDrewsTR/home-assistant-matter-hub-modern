import {
  type BridgeConfig,
  type BridgeDataWithMetadata,
  BridgeStatus,
  HomeAssistantMatcherType,
} from "@home-assistant-matter-hub/common";
import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appTheme } from "../../theme/theme.ts";
import { HubAdvanced } from "./HubAdvanced.tsx";

const update = vi.fn();
vi.mock("../../hooks/data/bridges.ts", () => ({
  useUpdateBridge: () => update,
  useUsedPorts: () => ({ 5540: "home" }),
}));
vi.mock("../../routes.tsx", () => ({ navigation: {} }));
vi.mock("../../components/bridge/BridgeConfigEditor.tsx", () => ({
  BridgeConfigEditor: ({
    bridge,
    onSave,
    onDraftChange,
  }: {
    bridge: BridgeConfig;
    onSave: (config: BridgeConfig) => void;
    onDraftChange: (config: BridgeConfig) => void;
  }) => (
    <>
      <button
        type="button"
        onClick={() => onDraftChange({ ...bridge, name: "Changed" })}
      >
        Rename hub
      </button>
      <button
        type="button"
        onClick={() => onSave({ ...bridge, name: "Changed" })}
      >
        Save config
      </button>
    </>
  ),
}));
const bridge: BridgeDataWithMetadata = {
  id: "home",
  name: "Home",
  port: 5540,
  status: BridgeStatus.Running,
  deviceCount: 1,
  filter: {
    include: [
      { type: HomeAssistantMatcherType.Pattern, value: "sensor.temperature" },
    ],
    exclude: [],
  },
  featureFlags: { stableIdentity: true, autoComposedDevices: false },
  uniqueIdSuffix: "keep-this",
  priority: 12,
  basicInformation: {
    vendorId: 1,
    vendorName: "Test",
    productId: 1,
    productName: "Test",
    productLabel: "Test",
    hardwareVersion: 1,
    softwareVersion: 1,
  },
};
function renderAdvanced() {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <Link to="/other">Leave hub</Link>
          <HubAdvanced bridge={bridge} />
        </>
      ),
    },
    { path: "/other", element: <div>Other workspace</div> },
  ]);
  render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}
beforeEach(() => update.mockReset());
afterEach(cleanup);
describe("inline advanced configuration", () => {
  it("preserves identity and compatibility fields while omitting runtime metadata", async () => {
    update.mockResolvedValue({ ...bridge, name: "Changed" });
    const user = userEvent.setup();
    renderAdvanced();
    await user.click(screen.getByRole("button", { name: "Rename hub" }));
    await user.click(screen.getByRole("button", { name: "Save config" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0]).toMatchObject({
      id: "home",
      name: "Changed",
      uniqueIdSuffix: "keep-this",
      priority: 12,
      featureFlags: bridge.featureFlags,
      filter: bridge.filter,
    });
    expect(update.mock.calls[0][0]).not.toHaveProperty("status");
    expect(update.mock.calls[0][0]).not.toHaveProperty("basicInformation");
  });
  it("protects a configuration draft when leaving the workspace", async () => {
    const user = userEvent.setup();
    const router = renderAdvanced();
    await user.click(screen.getByRole("button", { name: "Rename hub" }));
    await user.click(screen.getByRole("link", { name: "Leave hub" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/");
    expect(update).not.toHaveBeenCalled();
  });
});
