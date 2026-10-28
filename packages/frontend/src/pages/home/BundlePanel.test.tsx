import {
  type BridgeDataWithMetadata,
  BridgeStatus,
  HomeAssistantMatcherType,
} from "@home-assistant-matter-hub/common";
import { ThemeProvider } from "@mui/material/styles";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBridges } from "../../api/bridges.ts";
import {
  fetchEntityMappings,
  updateEntityMapping,
} from "../../api/entity-mappings.ts";
import { fetchHomeEntities } from "../../api/home-inventory.ts";
import { appTheme } from "../../theme/theme.ts";
import { BundlePanel } from "./BundlePanel.tsx";

vi.mock("../../api/home-inventory.ts", () => ({ fetchHomeEntities: vi.fn() }));
vi.mock("../../api/entity-mappings.ts", () => ({
  fetchEntityMappings: vi.fn(),
  updateEntityMapping: vi.fn(),
}));
vi.mock("../../api/bridges.ts", () => ({ fetchBridges: vi.fn() }));
vi.mock("../../routes.tsx", () => ({
  navigation: { hub: () => "/?view=advanced" },
}));
const bridge: BridgeDataWithMetadata = {
  id: "home",
  name: "Home",
  port: 5540,
  status: BridgeStatus.Running,
  deviceCount: 2,
  filter: {
    include: [
      { type: HomeAssistantMatcherType.Pattern, value: "sensor.temperature" },
    ],
    exclude: [],
  },
  featureFlags: { stableIdentity: true },
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
function renderPanel() {
  const router = createMemoryRouter([
    { path: "/", element: <BundlePanel bridge={bridge} /> },
  ]);
  return render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchHomeEntities).mockResolvedValue([
    {
      entity_id: "sensor.temperature",
      domain: "sensor",
      device_id: "monitor",
      state: "20",
      attributes: { device_class: "temperature", unit_of_measurement: "°C" },
    },
    {
      entity_id: "sensor.humidity",
      domain: "sensor",
      device_id: "monitor",
      state: "50",
      attributes: { device_class: "humidity", unit_of_measurement: "%" },
    },
  ]);
  vi.mocked(fetchEntityMappings).mockResolvedValue({
    bridgeId: "home",
    mappings: [],
  });
  vi.mocked(fetchBridges).mockResolvedValue([bridge]);
});
afterEach(cleanup);
describe("bundle approval", () => {
  it("builds and saves a custom device with explicitly chosen sub-device types", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Build a custom device" }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Primary shared entity" }),
    );
    await user.paste("sensor.temperature");
    await user.click(
      await screen.findByRole("option", {
        name: "sensor.temperature (sensor.temperature)",
      }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Additional capabilities" }),
    );
    await user.paste("sensor.humidity");
    await user.click(
      await screen.findByRole("option", {
        name: "sensor.humidity (sensor.humidity)",
      }),
    );
    await user.click(screen.getByRole("combobox", { name: "sensor.humidity" }));
    await user.click(
      await screen.findByRole("option", { name: "Humidity Sensor" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Preview bundle",
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(1),
    );
    expect(updateEntityMapping).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("checkbox", { name: /I reviewed the entities/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create this bundle" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Create this bundle" }),
    );
    await waitFor(() =>
      expect(updateEntityMapping).toHaveBeenCalledWith(
        "home",
        "sensor.temperature",
        {
          entityId: "sensor.temperature",
          composeDevice: true,
          composedEntities: [
            {
              entityId: "sensor.humidity",
              matterDeviceType: "humidity_sensor",
            },
          ],
          onlyIfUnmapped: true,
        },
      ),
    );
  });
  it("performs no writes until the user previews, approves, and applies", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Preview bundle" }),
    );
    expect(updateEntityMapping).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Create this bundle" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /I reviewed the entities/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create this bundle" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Create this bundle" }),
    );
    await waitFor(() =>
      expect(updateEntityMapping).toHaveBeenCalledWith(
        "home",
        "sensor.temperature",
        {
          entityId: "sensor.temperature",
          composeDevice: true,
          composedEntities: [
            {
              entityId: "sensor.humidity",
              matterDeviceType: "humidity_sensor",
            },
          ],
          onlyIfUnmapped: true,
        },
      ),
    );
    expect(fetchBridges).toHaveBeenCalledOnce();
  });
  it("refuses a bundle if a mapping changed after its preview", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Preview bundle" }),
    );
    vi.mocked(fetchEntityMappings).mockResolvedValue({
      bridgeId: "home",
      mappings: [
        { entityId: "sensor.temperature", customName: "Keep this override" },
      ],
    });
    await user.click(
      screen.getByRole("checkbox", { name: /I reviewed the entities/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create this bundle" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Create this bundle" }),
    );
    await screen.findByText(/A member already has a mapping/);
    expect(updateEntityMapping).not.toHaveBeenCalled();
  });
  it("surfaces persistence failures without pretending the bundle succeeded", async () => {
    vi.mocked(updateEntityMapping).mockRejectedValue(
      new Error("Disk unavailable"),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Preview bundle" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /I reviewed the entities/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create this bundle" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Create this bundle" }),
    );
    await screen.findByText(/Disk unavailable/);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(updateEntityMapping).toHaveBeenCalledOnce();
  });
});
