import type { EntityMappingConfig } from "@home-assistant-matter-hub/common";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchEntityMappings,
  updateEntityMapping,
} from "../../api/entity-mappings.js";
import { EntityMappingSection } from "./EntityMappingSection.tsx";

vi.mock("../../api/entity-mappings.js", () => ({
  fetchEntityMappings: vi.fn(),
  updateEntityMapping: vi.fn(),
  deleteEntityMapping: vi.fn(),
}));
vi.mock("./EntityMappingDialog.js", () => ({
  EntityMappingDialog: ({
    onSave,
    currentMapping,
    error,
    saving,
  }: {
    onSave: (config: EntityMappingConfig) => void;
    currentMapping: EntityMappingConfig;
    error?: string;
    saving?: boolean;
  }) => (
    <div role="dialog" aria-label="Mapping editor">
      {error}
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave({ ...currentMapping, customName: "Renamed" })}
      >
        Save mapping
      </button>
    </div>
  ),
}));
const mapping: EntityMappingConfig = {
  entityId: "sensor.room",
  customName: "Room monitor",
  composedEntities: [{ entityId: "sensor.humidity" }],
  customSerialNumber: "existing",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchEntityMappings).mockResolvedValue({
    bridgeId: "home",
    mappings: [
      mapping,
      { entityId: "switch.plug", customName: "Desk plug", disabled: true },
    ],
  });
});
afterEach(cleanup);
describe("progressive mapping controls", () => {
  it("searches inside overrides without expanding cards or writing configuration", async () => {
    render(<EntityMappingSection bridgeId="home" />);
    await screen.findByRole("button", { name: "Edit mapping for sensor.room" });
    const search = screen.getByRole("textbox", {
      name: "Search entities, names, types, or overrides",
    });
    await userEvent.type(search, "humidity");
    expect(
      screen.getByText("Room monitor", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Desk plug")).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "no-matching-device");
    expect(
      screen.getByText("No entities match these filters."),
    ).toBeInTheDocument();
    expect(updateEntityMapping).not.toHaveBeenCalled();
  });
  it("passes the original mapping as a concurrency guard and shows write errors inside the editor", async () => {
    vi.mocked(updateEntityMapping).mockRejectedValue(
      new Error("Changed remotely"),
    );
    render(<EntityMappingSection bridgeId="home" />);
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Edit mapping for sensor.room",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save mapping" }));
    await waitFor(() =>
      expect(updateEntityMapping).toHaveBeenCalledWith("home", "sensor.room", {
        ...mapping,
        customName: "Renamed",
        expectedMapping: mapping,
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Changed remotely");
    expect(screen.getByRole("button", { name: "Save mapping" })).toBeEnabled();
  });
});
