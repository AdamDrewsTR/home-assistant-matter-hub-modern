import {
  type BridgeDataWithMetadata,
  BridgeStatus,
  HomeAssistantMatcherType,
} from "@home-assistant-matter-hub/common";
import { ThemeProvider } from "@mui/material/styles";
import {
  act,
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
import { fetchSharingSelection } from "../../api/home-inventory.ts";
import { appTheme } from "../../theme/theme.ts";
import { HomePage } from "./HomePage.tsx";

vi.mock("../../api/bridges.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/bridges.ts")>()),
  fetchBridges: vi.fn(),
}));
vi.mock("./PairingChecklist.tsx", () => ({ PairingChecklist: () => null }));
vi.mock("../../api/home-inventory.ts", () => ({
  fetchSharingSelection: vi.fn(),
}));

const update = vi.fn();
const dispatch = vi.fn();
let bridges: BridgeDataWithMetadata[];
vi.mock("../../hooks/data/bridges.ts", () => ({
  useBridges: () => ({ content: bridges, isLoading: false }),
  useUpdateBridge: () => update,
}));
vi.mock("../../state/hooks.ts", () => ({ useAppDispatch: () => dispatch }));
vi.mock("../../routes.tsx", () => ({
  navigation: {
    bridge: (id: string) => `/bridges/${id}`,
    editBridge: (id: string) => `/bridges/${id}/edit`,
    hub: (id: string, view: string, section: string) =>
      `/?hub=${id}&view=${view}&section=${section}`,
  },
}));
vi.mock("../../components/bridge/BridgeDetails.tsx", () => ({
  PairingCard: () => <div>Pairing code</div>,
  FabricsCard: () => <div>Paired controllers</div>,
}));
vi.mock("../../components/bridge/PreflightPanel.tsx", () => ({
  PreflightPanel: () => null,
}));
vi.mock("../../components/bridge/FilterPreview.tsx", () => ({
  FilterPreview: () => <div>Advanced filter preview</div>,
}));
vi.mock("./EntityPicker.tsx", () => ({
  EntityPicker: ({
    onChange,
    selected,
    disabled,
  }: {
    onChange: (ids: string[]) => void;
    selected: string[];
    disabled: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onChange([])}>
      Clear selection {selected.join(",")}
    </button>
  ),
}));
vi.mock("./LocationSharing.tsx", () => ({
  LocationSharing: ({
    value,
    onChange,
    onPreview,
  }: {
    value: import("@home-assistant-matter-hub/common").LocationSharing;
    onChange: (
      value: import("@home-assistant-matter-hub/common").LocationSharing,
    ) => void;
    onPreview: (ids: string[]) => void;
  }) => {
    return (
      <button
        type="button"
        onClick={() => {
          onChange({ ...value, areaIds: ["office"] });
          onPreview(["light.desk"]);
        }}
      >
        Follow Office
      </button>
    );
  },
}));

function bridge(id: string): BridgeDataWithMetadata {
  return {
    id,
    name: `Hub ${id}`,
    port: 5540,
    status: BridgeStatus.Running,
    deviceCount: 1,
    filter: {
      include: [
        { type: HomeAssistantMatcherType.Pattern, value: "light.desk" },
      ],
      exclude: [],
    },
    featureFlags: { stableIdentity: true },
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
}

function renderHome() {
  const router = createMemoryRouter([
    { path: "/", element: <HomePage /> },
    { path: "/setup", element: <div>New hub</div> },
  ]);
  render(
    <ThemeProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  bridges = [bridge("one"), bridge("two")];
  vi.mocked(fetchBridges).mockImplementation(async () => bridges);
  vi.mocked(fetchSharingSelection).mockReset();
  vi.mocked(fetchSharingSelection).mockResolvedValue(["light.desk"]);
  update.mockReset();
  update.mockImplementation(async (request) => {
    bridges = bridges.map((item) =>
      item.id === request.id ? { ...item, ...request } : item,
    );
    return bridges[0];
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("home workspace", () => {
  it("saves live location rules only after review, preserving the hub identity", async () => {
    renderHome();
    await userEvent.click(
      screen.getByRole("radio", { name: "Follow rooms or floors" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Follow Office" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "future eligible additions and removals",
    );
    expect(update).not.toHaveBeenCalled();
    await approve();
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0]).toMatchObject({
      id: "one",
      port: 5540,
      featureFlags: { stableIdentity: true },
      filter: {
        include: [],
        exclude: [],
        location: {
          areaIds: ["office"],
          floorIds: [],
          excludedDeviceIds: [],
          excludedEntityIds: [],
        },
      },
    });
  });
  it("requires a preview and allows a deliberate switch back to fixed selection", async () => {
    bridges[0] = {
      ...bridges[0],
      filter: {
        include: [],
        exclude: [],
        location: {
          areaIds: ["office"],
          floorIds: [],
          excludedDeviceIds: [],
          excludedEntityIds: [],
        },
      },
    };
    renderHome();
    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: "Choose devices" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: "Choose devices" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Automatic location sharing will stop",
    );
    await approve();
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0].filter).toEqual({
      include: [{ type: "pattern", value: "light.desk" }],
      exclude: [],
    });
  });
  it("finishes pairing on the same hub's devices without retaining the pairing entry", async () => {
    const router = renderHome();
    await act(() => router.navigate("/?hub=two&view=pair"));
    await userEvent.click(
      screen.getByRole("button", { name: "Done - view devices" }),
    );
    expect(router.state.location.search).toBe("?hub=two&view=devices");
    expect(screen.getByRole("heading", { name: "Your home" })).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(
      screen.getByRole("button", { name: /Clear selection/ }),
    ).toBeInTheDocument();
    await act(() => router.navigate(-1));
    expect(router.state.location.search).toBe("");
  });
  async function approve() {
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "I reviewed the changes and their impact",
      }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply changes" }),
    );
  }
  it("applies an empty selection safely while preserving hub identity and configuration", async () => {
    renderHome();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear selection/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    expect(update).not.toHaveBeenCalled();
    await approve();
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0]).toMatchObject({
      id: "one",
      port: 5540,
      priority: 12,
      featureFlags: { stableIdentity: true },
      filter: { include: [{ type: "regex", value: "^$" }], exclude: [] },
    });
    expect(update.mock.calls[0][0]).not.toHaveProperty("basicInformation");
    expect(update.mock.calls[0][0]).not.toHaveProperty("status");
    expect(await screen.findByText(/Sharing updated/)).toBeInTheDocument();
  });

  it("protects pending changes when switching hubs", async () => {
    const router = renderHome();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear selection/ }),
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Your hub" }));
    await userEvent.click(screen.getByRole("option", { name: "Hub two" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Discard unsaved changes?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.search).toBe("");
    expect(
      await screen.findByRole("button", { name: "Apply changes" }),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("shows a rule-based hub's devices without silently converting its rules", async () => {
    bridges[0] = {
      ...bridge("one"),
      filter: {
        include: [{ type: HomeAssistantMatcherType.Pattern, value: "*" }],
        exclude: [],
      },
    };
    renderHome();
    expect(
      screen.getByText(/This hub currently follows sharing rules/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Clear selection light.desk/ }),
    ).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });
  it("explicitly converts legacy rules through the same reviewed device selection", async () => {
    bridges[0] = {
      ...bridge("one"),
      filter: {
        include: [{ type: HomeAssistantMatcherType.Pattern, value: "*" }],
        exclude: [],
      },
    };
    renderHome();
    const choose = screen.getByRole("button", {
      name: "Choose devices instead of rules",
    });
    await waitFor(() => expect(choose).toBeEnabled());
    await userEvent.click(choose);
    expect(
      screen.getByRole("button", { name: /Clear selection light.desk/ }),
    ).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    await approve();
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0][0]).toMatchObject({
      filter: {
        include: [{ type: "pattern", value: "light.desk" }],
        exclude: [],
      },
      featureFlags: { stableIdentity: true },
      port: 5540,
    });
  });
  it("does not offer conversion when the complete server selection cannot be read", async () => {
    bridges[0] = { ...bridge("one"), filter: { include: [], exclude: [] } };
    vi.mocked(fetchSharingSelection).mockRejectedValue(
      new Error("Incomplete sharing selection"),
    );
    renderHome();
    expect(
      await screen.findByText("Incomplete sharing selection"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose devices instead of rules" }),
    ).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("waits for an in-flight save before completing navigation", async () => {
    let finish!: (updated: BridgeDataWithMetadata) => void;
    update.mockImplementationOnce(
      () =>
        new Promise<BridgeDataWithMetadata>((resolve) => {
          finish = resolve;
        }),
    );
    const router = renderHome();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear selection/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    await approve();
    await act(async () => {
      await router.navigate("/?hub=one&view=pair");
    });
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("dialog")).toHaveTextContent("Review changes");
    await act(async () => {
      bridges[0] = {
        ...bridges[0],
        filter: {
          include: [{ type: HomeAssistantMatcherType.Regex, value: "^$" }],
          exclude: [],
        },
      };
      finish(bridges[0]);
    });
    await waitFor(() =>
      expect(router.state.location.search).toBe("?hub=one&view=pair"),
    );
    expect(screen.getByText("Pairing code")).toBeInTheDocument();
  });

  it("keeps edits and shows the error when saving fails", async () => {
    update.mockRejectedValueOnce(new Error("HA is unavailable"));
    renderHome();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear selection/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    await approve();
    expect(
      await screen.findByText(/HA is unavailable.*Inspect/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Apply changes",
      }),
    ).toBeEnabled();
  });
  it("refuses a selection apply when the server filter has changed", async () => {
    renderHome();
    await userEvent.click(
      screen.getByRole("button", { name: /Clear selection/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Apply changes" }),
    );
    vi.mocked(fetchBridges).mockResolvedValue([
      { ...bridge("one"), filter: { include: [], exclude: [] } },
    ]);
    await approve();
    await screen.findByText(/No automatic retry/);
    expect(update).not.toHaveBeenCalled();
  });

  it("starts an empty home with one clear setup action", () => {
    bridges = [];
    renderHome();
    expect(
      screen.getByRole("link", { name: "Connect your home" }),
    ).toHaveAttribute("href", "/setup");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
