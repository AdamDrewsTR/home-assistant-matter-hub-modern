import {
  type BridgeDataWithMetadata,
  BridgeStatus,
} from "@home-assistant-matter-hub/common";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openCommissioningWindow } from "../../api/bridges.ts";
import { PairingCard } from "./BridgeDetails.tsx";

vi.mock("../../api/bridges.ts", () => ({
  openCommissioningWindow: vi.fn(),
}));
vi.mock("../../routes.tsx", () => ({ navigation: {} }));
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
  commissioning: {
    isCommissioned: false,
    manualPairingCode: "34970112332",
    qrPairingCode: "MT:Y.K9042C00KA0648G00",
    passcode: 20202021,
    discriminator: 3840,
    fabrics: [],
  },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("pairing code copying", () => {
  it("copies when the number is clicked and confirms only after success", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<PairingCard bridge={bridge} />);
    expect(
      screen.getByRole("img", { name: "Matter pairing QR code" }),
    ).toBeInTheDocument();
    await user.click(screen.getByText("34970112332"));
    expect(write).toHaveBeenCalledWith("34970112332");
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    finish();
    expect(await screen.findByText("Copied!")).toHaveAttribute(
      "role",
      "status",
    );
    write.mockResolvedValue();
    await user.click(screen.getByRole("button", { name: /Copy Manual/ }));
    expect(write).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("shows failed clipboard access and lets the user retry", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("Permission denied"));
    render(<PairingCard bridge={bridge} />);
    await user.click(screen.getByText("34970112332"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not copy",
    );
    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    write.mockResolvedValue();
    await user.click(screen.getByText("34970112332"));
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("copies each displayed value in the add-controller dialog", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    vi.mocked(openCommissioningWindow).mockResolvedValue({
      success: true,
      bridge,
    });
    render(
      <PairingCard
        bridge={{
          ...bridge,
          commissioning: { ...bridge.commissioning!, isCommissioned: true },
        }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Add Another Controller" }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    for (const value of ["34970112332", "20202021", "3840"]) {
      await user.click(dialog.getByText(value));
      expect(write).toHaveBeenLastCalledWith(value);
    }
    expect(dialog.getAllByRole("status")).toHaveLength(3);
  });
});
