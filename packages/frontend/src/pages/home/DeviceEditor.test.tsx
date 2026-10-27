import {
  type BridgeDataWithMetadata,
  BridgeStatus,
  type EntityMappingConfig,
} from "@home-assistant-matter-hub/common";
import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackupSnapshot } from "../../api/backup.ts";
import {
  fetchEntityMappings,
  updateEntityMapping,
} from "../../api/entity-mappings.ts";
import {
  fetchHomeEntities,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import { appTheme } from "../../theme/theme.ts";
import { DeviceEditor } from "./DeviceEditor.tsx";

vi.mock("../../api/entity-mappings.ts", () => ({
  fetchEntityMappings: vi.fn(),
  updateEntityMapping: vi.fn(),
}));
vi.mock("../../api/home-inventory.ts", () => ({ fetchHomeEntities: vi.fn() }));
vi.mock("../../api/backup.ts", () => ({ createBackupSnapshot: vi.fn() }));
const inventory: HomeEntity[] = [
  {
    entity_id: "sensor.temperature",
    domain: "sensor",
    friendly_name: "Room monitor",
    state: "20",
    attributes: { device_class: "temperature", unit_of_measurement: "°C" },
  },
  {
    entity_id: "sensor.humidity",
    domain: "sensor",
    state: "40",
    attributes: { device_class: "humidity", unit_of_measurement: "%" },
  },
];
const bridge: BridgeDataWithMetadata = {
  id: "home",
  name: "Home",
  port: 5540,
  status: BridgeStatus.Running,
  deviceCount: 1,
  filter: { include: [], exclude: [] },
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
const mapping: EntityMappingConfig = {
  entityId: "sensor.temperature",
  customName: "Room",
  composeDevice: true,
  composedEntities: [
    { entityId: "sensor.humidity", matterDeviceType: "humidity_sensor" },
  ],
  customSerialNumber: "existing",
  updateThrottleMs: 200,
  disableBatteryMapping: true,
};
const close = vi.fn();
const shared = vi.fn();
function renderEditor() {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <DeviceEditor
          entity={inventory[0]}
          inventory={inventory}
          bridge={bridge}
          mapping={mapping}
          shared
          onSharedChange={shared}
          onSaved={vi.fn()}
          onClose={close}
        />
      ),
    },
  ]);
  return render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}
async function review() {
  await userEvent.click(
    screen.getByRole("button", { name: "Preview changes" }),
  );
  await userEvent.click(
    screen.getByRole("checkbox", {
      name: "I reviewed the changes and their impact",
    }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchEntityMappings).mockResolvedValue({
    bridgeId: "home",
    mappings: [mapping],
  });
  vi.mocked(fetchHomeEntities).mockResolvedValue(inventory);
  vi.mocked(updateEntityMapping).mockResolvedValue(mapping);
});
afterEach(cleanup);
describe("visual device editing", () => {
  it("returns keyboard focus to its opener after discarding an edit", async () => {
    function WithTrigger() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Configure bundle
          </button>
          {open && (
            <DeviceEditor
              entity={inventory[0]}
              inventory={inventory}
              bridge={bridge}
              mapping={mapping}
              onClose={() => setOpen(false)}
              onSaved={vi.fn()}
            />
          )}
        </>
      );
    }
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: "/", element: <WithTrigger /> }])}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Configure bundle" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Discard changes" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Configure bundle" }),
      ).toHaveFocus(),
    );
  });
  it("keeps the capability picker open after removing a bundle", async () => {
    renderEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    const picker = screen.getByRole("combobox", {
      name: "Additional capabilities",
    });
    expect(picker.closest("details")).toHaveAttribute("open");
    await userEvent.click(picker);
    await userEvent.click(
      await screen.findByRole("option", {
        name: "sensor.humidity (sensor.humidity)",
      }),
    );
    expect(picker.closest("details")).toHaveAttribute("open");
    expect(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    ).toBeInTheDocument();
    expect(updateEntityMapping).not.toHaveBeenCalled();
  });
  it("reviews and unbundles without removing identities or unrelated overrides", async () => {
    renderEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    await review();
    expect(screen.getByText("Composed capabilities")).toBeInTheDocument();
    expect(updateEntityMapping).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(updateEntityMapping).toHaveBeenCalledWith(
      "home",
      mapping.entityId,
      expect.objectContaining({
        customSerialNumber: "existing",
        updateThrottleMs: 200,
        disableBatteryMapping: true,
        composedEntities: undefined,
        composeDevice: undefined,
        expectedMapping: mapping,
      }),
    );
    expect(createBackupSnapshot).not.toHaveBeenCalled();
  });
  it("does not apply anything when the explicitly requested snapshot fails", async () => {
    vi.mocked(createBackupSnapshot).mockRejectedValue(
      new Error("Snapshot disk full"),
    );
    renderEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    await review();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Create a configuration snapshot before applying",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(await screen.findByText(/Snapshot disk full/)).toBeInTheDocument();
    expect(updateEntityMapping).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
  it("refuses a stale mapping without losing the draft", async () => {
    vi.mocked(fetchEntityMappings).mockResolvedValue({
      bridgeId: "home",
      mappings: [{ ...mapping, customName: "Remote" }],
    });
    renderEditor();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(
      await screen.findByText(/mapping changed elsewhere/),
    ).toBeInTheDocument();
    expect(updateEntityMapping).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
  it("stages sharing changes without an implicit mapping or hub write", async () => {
    renderEditor();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Include in sharing selection" }),
    );
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    await waitFor(() => expect(shared).toHaveBeenCalledWith(false));
    expect(updateEntityMapping).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps a failed mapping edit from staging an unrelated sharing write", async () => {
    vi.mocked(updateEntityMapping).mockRejectedValue(
      new Error("Storage failed"),
    );
    renderEditor();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Include in sharing selection" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove composed capabilities" }),
    );
    await review();
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(await screen.findByText(/Storage failed/)).toBeInTheDocument();
    expect(shared).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
