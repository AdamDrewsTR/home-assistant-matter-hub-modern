import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { Endpoint, VendorId } from "@matter/main";
import { FanControl } from "@matter/main/clusters";
import { ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../../../services/bridges/bridge-data-provider.js";
import { HomeAssistantConfig } from "../../../../services/home-assistant/home-assistant-config.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { AggregatorEndpoint } from "../../aggregator-endpoint.js";
import { FanDevice } from "./index.js";

// #515: HA reports the fan direction in the "direction" attribute, we read
// "current_direction", so airflowDirection stayed Forward for reversed fans.

let dir: string;
let env: Environment;
let server: ServerNode | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-fan515-"));
  env = new Environment("test", Environment.default);
  env.get(VariableService).set("storage.path", dir);
  env.set(
    BridgeDataProvider,
    new BridgeDataProvider({
      id: "b",
      name: "b",
      port: 0,
      filter: { include: [], exclude: [], includeMode: "any" },
      basicInformation: {
        vendorId: 0xfff1,
        vendorName: "t",
        productName: "t",
        productLabel: "t",
        hardwareVersion: 1,
        softwareVersion: 1,
        // biome-ignore lint/suspicious/noExplicitAny: test fixture
      } as any,
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any),
  );
  env.set(HomeAssistantConfig, {
    unitSystem: { temperature: "°C" },
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
});

afterEach(async () => {
  await server?.close().catch(() => {});
  server = undefined;
  rmSync(dir, { recursive: true, force: true });
});

// The reporter's fan: SET_SPEED, DIRECTION, TURN_ON, TURN_OFF (53).
function fanEntity(direction: string): HomeAssistantEntityInformation {
  const full = {
    entity_id: "fan.test",
    state: "off",
    attributes: {
      friendly_name: "Fan",
      supported_features: 53,
      direction,
      percentage: 33,
      percentage_step: 1,
      preset_modes: null,
    },
    context: { id: "ctx" },
    last_changed: "2026-01-01T00:00:00",
    last_updated: "2026-01-01T00:00:00",
  };
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  return { entity_id: "fan.test", state: full as any };
}

async function mount(direction: string) {
  server = await ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: env as any,
    id: "fan515-node",
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  const endpoint = new Endpoint(
    FanDevice({ entity: fanEntity(direction) } as never),
    { id: "fan" },
  );
  await aggregator.add(endpoint);
  return endpoint;
}

// biome-ignore lint/suspicious/noExplicitAny: inspect cluster state
const fanControl = (endpoint: Endpoint) => (endpoint.state as any).fanControl;

describe("fan airflowDirection follows HA direction (#515)", () => {
  it("reports Reverse for a reversed fan", async () => {
    const endpoint = await mount("reverse");
    expect(fanControl(endpoint).featureMap.airflowDirection).toBe(true);
    expect(fanControl(endpoint).airflowDirection).toBe(
      FanControl.AirflowDirection.Reverse,
    );
  });

  it("follows direction changes made in HA", async () => {
    const endpoint = await mount("forward");
    expect(fanControl(endpoint).airflowDirection).toBe(
      FanControl.AirflowDirection.Forward,
    );
    await endpoint.setStateOf(HomeAssistantEntityBehavior, {
      entity: fanEntity("reverse"),
    });
    expect(fanControl(endpoint).airflowDirection).toBe(
      FanControl.AirflowDirection.Reverse,
    );
    await endpoint.setStateOf(HomeAssistantEntityBehavior, {
      entity: fanEntity("forward"),
    });
    expect(fanControl(endpoint).airflowDirection).toBe(
      FanControl.AirflowDirection.Forward,
    );
  });
});
