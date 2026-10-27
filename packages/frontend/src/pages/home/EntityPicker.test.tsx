import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHomeEntities } from "../../api/home-inventory.ts";
import { fetchAreas } from "../../api/labels.ts";
import { appTheme } from "../../theme/theme.ts";
import { EntityPicker } from "./EntityPicker.tsx";

vi.mock("../../api/home-inventory.ts", () => ({ fetchHomeEntities: vi.fn() }));
vi.mock("../../api/labels.ts", () => ({ fetchAreas: vi.fn() }));

function Picker() {
  const [selected, setSelected] = useState(["light.bedroom", "sensor.missing"]);
  return (
    <ThemeProvider theme={appTheme}>
      <EntityPicker selected={selected} onChange={setSelected} />
      <output>{selected.join(",")}</output>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.mocked(fetchAreas).mockResolvedValue([
    { area_id: "kitchen", name: "Kitchen" },
  ]);
  vi.mocked(fetchHomeEntities).mockResolvedValue([
    {
      entity_id: "light.kitchen",
      friendly_name: "Kitchen lamp",
      domain: "light",
      device_id: "lamp",
      device_name: "Kitchen fixture",
      area_id: "kitchen",
      state: "on",
    },
    {
      entity_id: "light.bedroom",
      friendly_name: "Bedroom lamp",
      domain: "light",
      state: "off",
    },
    {
      entity_id: "sensor.diagnostic",
      friendly_name: "Diagnostic",
      domain: "sensor",
      entity_category: "diagnostic",
      state: "100",
    },
  ]);
});
afterEach(cleanup);

describe("device picker", () => {
  it("keeps entity names clickable without nesting configuration actions inside their labels", async () => {
    render(<Picker />);
    await userEvent.click(await screen.findByText("Kitchen lamp"));
    expect(
      screen.getByRole("checkbox", { name: "Kitchen lamp" }),
    ).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "light.bedroom,sensor.missing,light.kitchen",
    );
  });
  it("limits bulk changes to the search results and preserves missing selections", async () => {
    render(<Picker />);
    const search = await screen.findByRole("textbox", {
      name: "Search devices and entities",
    });
    expect(screen.queryByText("Diagnostic")).not.toBeInTheDocument();
    await userEvent.type(search, "Kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Select shown" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "light.bedroom,sensor.missing,light.kitchen",
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear shown" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "light.bedroom,sensor.missing",
    );
  });

  it("offers a working retry after an inventory failure", async () => {
    vi.mocked(fetchHomeEntities).mockRejectedValueOnce(
      new Error("Cannot reach HA"),
    );
    render(<Picker />);
    expect(await screen.findByText("Cannot reach HA")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByText("Kitchen lamp")).toBeInTheDocument(),
    );
  });
});
