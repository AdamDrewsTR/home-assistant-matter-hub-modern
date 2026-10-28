import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  fetchHomeEntities,
  fetchLocations,
  fetchSharingSelection,
} from "../../api/home-inventory.ts";
import { LocationSharing } from "./LocationSharing.tsx";
import { emptyLocationSharing } from "./sharing.ts";

vi.mock("../../api/home-inventory.ts", () => ({
  fetchLocations: vi.fn(),
  fetchHomeEntities: vi.fn(),
  fetchSharingSelection: vi.fn(),
}));
const preview = vi.fn();
function Harness() {
  const [value, setValue] = useState(emptyLocationSharing);
  return (
    <LocationSharing value={value} onChange={setValue} onPreview={preview} />
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchLocations).mockResolvedValue({
    areas: [{ area_id: "office", name: "Office", floor_id: "upstairs" }],
    floors: [{ floor_id: "upstairs", name: "Upstairs" }],
  });
  vi.mocked(fetchHomeEntities).mockResolvedValue([
    {
      entity_id: "light.desk",
      device_id: "lamp",
      device_name: "Desk lamp",
      domain: "light",
      state: "on",
    },
  ]);
  vi.mocked(fetchSharingSelection).mockResolvedValue([]);
});
afterEach(cleanup);
it("offers rooms and floors, keeps exclusions separate, and previews rules without writes", async () => {
  render(<Harness />);
  const locations = await screen.findByRole("combobox", {
    name: "Rooms and floors to follow",
  });
  await userEvent.click(locations);
  await userEvent.click(screen.getByRole("option", { name: "Upstairs" }));
  await userEvent.keyboard("{Escape}");
  await waitFor(() =>
    expect(fetchSharingSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          floorIds: ["upstairs"],
          areaIds: [],
        }),
      }),
      expect.any(AbortSignal),
    ),
  );
  await userEvent.click(
    screen.getByText("Customize what is shared (0 exclusions)"),
  );
  await userEvent.click(
    screen.getByRole("combobox", { name: "Devices to leave out" }),
  );
  await userEvent.click(
    screen.getByRole("option", { name: "Desk lamp (lamp)" }),
  );
  await waitFor(() =>
    expect(fetchSharingSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          floorIds: ["upstairs"],
          excludedDeviceIds: ["lamp"],
        }),
      }),
      expect.any(AbortSignal),
    ),
  );
});
it("invalidates stale previews immediately and ignores results from superseded requests", async () => {
  let resolve!: (ids: string[]) => void;
  vi.mocked(fetchSharingSelection).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { rerender } = render(
    <LocationSharing
      value={emptyLocationSharing}
      onChange={vi.fn()}
      onPreview={preview}
    />,
  );
  await screen.findByRole("combobox", { name: "Rooms and floors to follow" });
  rerender(
    <LocationSharing
      value={{ ...emptyLocationSharing, areaIds: ["office"] }}
      onChange={vi.fn()}
      onPreview={preview}
    />,
  );
  await waitFor(() => expect(preview).toHaveBeenLastCalledWith([]));
  await act(async () => resolve(["light.stale"]));
  expect(preview).not.toHaveBeenCalledWith(["light.stale"]);
});
it("shows missing locations and errors without reporting a successful empty preview", async () => {
  vi.mocked(fetchSharingSelection).mockRejectedValue(
    new Error("Preview unavailable"),
  );
  render(
    <LocationSharing
      value={{ ...emptyLocationSharing, areaIds: ["deleted"] }}
      onChange={vi.fn()}
      onPreview={preview}
    />,
  );
  expect(
    await screen.findByText(/A selected room or floor no longer exists/),
  ).toBeInTheDocument();
  expect(await screen.findByText("Preview unavailable")).toBeInTheDocument();
  expect(preview).not.toHaveBeenCalledWith([]);
});
