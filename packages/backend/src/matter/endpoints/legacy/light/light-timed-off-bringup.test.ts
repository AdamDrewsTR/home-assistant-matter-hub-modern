import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Environment, StorageService, VariableService } from "@matter/general";
import { Endpoint, VendorId } from "@matter/main";
import { ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// endpoint.act() runs as a local actor, which never fails while HA is down.
// Forced false so a command fails the way a real Matter command does (#446).
vi.mock("../../../../utils/transaction-is-offline.js", () => ({
  transactionIsOffline: () => false,
}));

import { BridgeDataProvider } from "../../../../services/bridges/bridge-data-provider.js";
import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../../../services/home-assistant/home-assistant-actions.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { AggregatorEndpoint } from "../../aggregator-endpoint.js";
import { createLegacyEndpointType } from "../create-legacy-endpoint-type.js";

// Lights and the other Lighting OnOff shapes run the matter.js OnWithTimedOff
// countdown. A later Off has to end it (spec 1.5.7.1), otherwise the late off
// turns the entity off again. The matter.js timers tick every 100 ms, so the
// tests run on a fake clock and keep storage in memory.

let dir: string;
let env: Environment;
let calls: string[];
let available: boolean;
let server: ServerNode | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-timed-off-"));
  env = new Environment("test", Environment.default);
  env.get(VariableService).set("storage.path", dir);
  env.get(StorageService).configuredDriver = "memory";
  calls = [];
  available = true;
  env.set(HomeAssistantActions, {
    get available() {
      return available;
    },
    call(action: HomeAssistantAction) {
      calls.push(action.action);
    },
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
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
});

afterEach(async () => {
  vi.useRealTimers();
  await server?.close().catch(() => {});
  server = undefined;
  rmSync(dir, { recursive: true, force: true });
});

type Shape = [string, string, string, Record<string, unknown>, object?];
// entity, off state, on state, attributes, mapping
const shapes: Shape[] = [
  ["light.lt", "off", "on", { supported_color_modes: ["onoff"] }],
  ["light.dim", "off", "on", { supported_color_modes: ["brightness"] }],
  [
    "switch.mounted",
    "off",
    "on",
    {},
    { matterDeviceType: "mounted_on_off_control" },
  ],
  ["switch.asswitch", "off", "on", {}, { matterDeviceType: "on_off_switch" }],
  [
    "switch.dimplug",
    "off",
    "on",
    {},
    { matterDeviceType: "dimmable_plugin_unit" },
  ],
  [
    "valve.asswitch",
    "closed",
    "open",
    {},
    { matterDeviceType: "on_off_switch" },
  ],
  [
    "cover.asswitch",
    "closed",
    "open",
    {},
    { matterDeviceType: "on_off_switch" },
  ],
];
const plug: Shape = ["switch.plain", "off", "on", {}];

let seq = 0;
function entity([entityId, , , attributes]: Shape, state: string) {
  seq++;
  return {
    entity_id: entityId,
    state: {
      entity_id: entityId,
      state,
      attributes: { friendly_name: entityId, ...attributes },
      context: { id: `ctx-${seq}` },
      last_changed: "2026-01-01T00:00:00",
      last_updated: "2026-01-01T00:00:00",
    },
  } as HomeAssistantEntityInformation;
}

async function mount(list = shapes) {
  server = await ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: env as any,
    id: "timed-off-node",
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  const endpoints = new Map<Shape, Endpoint>();
  for (const shape of list) {
    const type = createLegacyEndpointType(entity(shape, shape[1]), {
      entityId: shape[0],
      ...shape[4],
    } as EntityMappingConfig);
    if (!type) throw new Error(shape[0]);
    const endpoint = new Endpoint(type, { id: shape[0].replace(".", "_") });
    await aggregator.add(endpoint);
    endpoints.set(shape, endpoint);
  }
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  return endpoints;
}

// Lock first like a real invoke does, a running countdown tick may hold it.
async function onOffAct(
  endpoint: Endpoint,
  // biome-ignore lint/suspicious/noExplicitAny: drive the cluster
  fn: (onOff: any) => unknown,
) {
  await endpoint.act(async (agent) => {
    // biome-ignore lint/suspicious/noExplicitAny: behavior doubles as resource
    const onOff = (agent as any).onOff;
    await agent.context.transaction.addResources(onOff);
    await agent.context.transaction.begin();
    await fn(onOff);
  });
}

const command = (endpoint: Endpoint, name: string, request?: object) =>
  onOffAct(endpoint, (onOff) => onOff[name](request));

const onOffOf = (endpoint: Endpoint) =>
  // biome-ignore lint/suspicious/noExplicitAny: read the Lighting attributes
  (endpoint.state as any).onOff;

const timesOf = (endpoint: Endpoint) => {
  const { onOff, onTime, offWaitTime } = onOffOf(endpoint);
  return [onOff, onTime, offWaitTime];
};

const timedOn = (onTime: number, offWaitTime = 0) => ({
  onOffControl: { acceptOnlyWhenOn: false },
  onTime,
  offWaitTime,
});

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("OnWithTimedOff on Lighting OnOff shapes", () => {
  it("a Matter Off ends the countdown", async () => {
    const endpoints = await mount();
    for (const endpoint of endpoints.values()) {
      await command(endpoint, "onWithTimedOff", timedOn(5));
    }
    await advance(100);
    for (const endpoint of endpoints.values()) {
      await command(endpoint, "off");
      expect(onOffOf(endpoint).onTime).toBe(0);
    }
    for (const endpoint of endpoints.values()) {
      await command(endpoint, "on");
    }
    calls.length = 0;
    await advance(1000);
    expect(calls).toEqual([]);
    for (const endpoint of endpoints.values()) {
      expect(onOffOf(endpoint).onOff).toBe(true);
    }
  });

  it("a Toggle or OffWithEffect ends the countdown too", async () => {
    const endpoints = await mount();
    const [light, dim] = [shapes[0], shapes[1]].map(
      (shape) => endpoints.get(shape) as Endpoint,
    );
    for (const endpoint of [light, dim]) {
      await command(endpoint, "onWithTimedOff", timedOn(5));
    }
    await command(light, "toggle");
    await command(dim, "offWithEffect", {
      effectIdentifier: 0,
      effectVariant: 0,
    });
    for (const endpoint of [light, dim]) {
      expect(timesOf(endpoint)).toEqual([false, 0, 0]);
      await command(endpoint, "on");
    }
    calls.length = 0;
    await advance(1000);
    expect(calls).toEqual([]);
  });

  it("still turns off once OnTime runs out", async () => {
    const endpoints = await mount();
    for (const endpoint of endpoints.values()) {
      await command(endpoint, "onWithTimedOff", timedOn(3, 2));
    }
    calls.length = 0;
    await advance(400);
    expect(calls.sort()).toEqual([
      "cover.close_cover",
      "homeassistant.turn_off",
      "homeassistant.turn_off",
      "homeassistant.turn_off",
      "homeassistant.turn_off",
      "homeassistant.turn_off",
      "valve.close_valve",
    ]);
    for (const endpoint of endpoints.values()) {
      expect(timesOf(endpoint)).toEqual([false, 0, 0]);
    }
  });

  it("still turns off after an HA open or an unavailable blip", async () => {
    const endpoints = await mount();
    const [light, valve] = [shapes[0], shapes[5]];
    for (const shape of [light, valve]) {
      await command(
        endpoints.get(shape) as Endpoint,
        "onWithTimedOff",
        timedOn(5),
      );
    }
    // past the 3 s that hold back HA states disagreeing with a command
    vi.setSystemTime(Date.now() + 4000);
    const report = (shape: Shape, state: string) =>
      (endpoints.get(shape) as Endpoint).setStateOf(
        HomeAssistantEntityBehavior,
        { entity: entity(shape, state) },
      );
    await report(valve, "open");
    await report(light, "unavailable");
    await report(light, "on");
    calls.length = 0;
    await advance(600);
    expect(calls.sort()).toEqual([
      "homeassistant.turn_off",
      "valve.close_valve",
    ]);
  });

  it("a failed Off keeps the countdown", async () => {
    const valve = shapes[5];
    const endpoint = (await mount([valve])).get(valve) as Endpoint;
    await command(endpoint, "onWithTimedOff", timedOn(5));
    available = false;
    await expect(command(endpoint, "off")).rejects.toThrow();
    available = true;
    calls.length = 0;
    await advance(1000);
    expect(calls).toEqual(["valve.close_valve"]);
  });

  it("a failed On keeps the off guard counting", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(5, 30));
    await command(endpoint, "off");
    available = false;
    await expect(command(endpoint, "on")).rejects.toThrow();
    available = true;
    await advance(3100);
    calls.length = 0;
    await command(endpoint, "onWithTimedOff", timedOn(5));
    expect(calls).toEqual(["light.turn_on"]);
  });

  it("an Off goes out while another transaction holds OnOff", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(50));
    let release = () => {};
    let holder: Promise<void> | undefined;
    await new Promise<void>((locked) => {
      holder = onOffAct(
        endpoint,
        () =>
          new Promise<void>((done) => {
            release = done;
            locked();
          }),
      );
    });
    calls.length = 0;
    // a scene apply turns off without taking the OnOff lock first
    // biome-ignore lint/suspicious/noExplicitAny: drive the cluster
    await endpoint.act((agent) => (agent as any).onOff.off());
    release();
    await holder;
    await advance(6000);
    expect(calls).toEqual(["homeassistant.turn_off"]);
  });

  it("an Off guards against OnWithTimedOff for OffWaitTime", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(5, 3));
    await command(endpoint, "off");
    calls.length = 0;
    await command(endpoint, "onWithTimedOff", timedOn(5, 3));
    expect(calls).toEqual([]);
    expect(onOffOf(endpoint).onOff).toBe(false);
    await advance(400);
    expect(onOffOf(endpoint).offWaitTime).toBe(0);
    await command(endpoint, "onWithTimedOff", timedOn(5, 3));
    expect(calls).toEqual(["light.turn_on"]);
    // the stale countdown of the first OnWithTimedOff never fires
    await command(endpoint, "off");
    await command(endpoint, "on");
    calls.length = 0;
    await advance(1000);
    expect(calls).toEqual([]);
  });

  it("an Off counts OffWaitTime down", async () => {
    const endpoints = await mount();
    for (const endpoint of endpoints.values()) {
      await command(endpoint, "onWithTimedOff", timedOn(5, 3));
      await command(endpoint, "off");
    }
    await advance(400);
    calls.length = 0;
    for (const endpoint of endpoints.values()) {
      expect(timesOf(endpoint)).toEqual([false, 0, 0]);
      await command(endpoint, "onWithTimedOff", timedOn(5));
      expect(onOffOf(endpoint).onOff).toBe(true);
    }
    expect(calls.length).toBe(endpoints.size);
  });

  it("an On ends the off guard", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(5, 30));
    await command(endpoint, "off");
    await command(endpoint, "on");
    expect(onOffOf(endpoint).offWaitTime).toBe(0);
    await command(endpoint, "off");
    calls.length = 0;
    await command(endpoint, "onWithTimedOff", timedOn(5));
    expect(calls).toEqual(["light.turn_on"]);
  });

  it("an On stops the off guard before a new timed on", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(5, 30));
    await command(endpoint, "off");
    await command(endpoint, "on");
    await command(endpoint, "onWithTimedOff", timedOn(50, 30));
    await advance(350);
    expect(timesOf(endpoint)).toEqual([true, 47, 30]);
  });

  it("keeps the OffWaitTime of an OnWithTimedOff with OnTime 0", async () => {
    const endpoints = await mount();
    const endpoint = [...endpoints.values()][0];
    await command(endpoint, "onWithTimedOff", timedOn(0, 30));
    expect(timesOf(endpoint)).toEqual([true, 0, 30]);
    await command(endpoint, "off");
    calls.length = 0;
    await command(endpoint, "onWithTimedOff", timedOn(5));
    expect(calls).toEqual([]);
    expect(onOffOf(endpoint).onOff).toBe(false);
  });

  it("changes nothing for On, Off and Toggle without a timed command", async () => {
    const endpoints = await mount();
    const changes: string[] = [];
    for (const endpoint of endpoints.values()) {
      // biome-ignore lint/suspicious/noExplicitAny: matter.js events
      const events = (endpoint.events as any).onOff;
      for (const name of ["onTime", "offWaitTime", "globalSceneControl"]) {
        events[`${name}$Changed`].on(() => changes.push(name));
      }
    }
    for (const endpoint of endpoints.values()) {
      for (const name of ["on", "off", "toggle", "toggle", "off"]) {
        await command(endpoint, name);
      }
    }
    expect(changes).toEqual([]);
    expect(calls.length).toBe(endpoints.size * 5);
  });
});

describe("OnOff plugs", () => {
  it("leave OnTime and OffWaitTime alone", async () => {
    const endpoint = (await mount([plug])).get(plug) as Endpoint;
    await onOffAct(endpoint, (onOff) => {
      onOff.state.onTime = 50;
      onOff.state.offWaitTime = 30;
    });
    await command(endpoint, "on");
    await command(endpoint, "off");
    expect(timesOf(endpoint)).toEqual([false, 50, 30]);
    await advance(400);
    expect(timesOf(endpoint)).toEqual([false, 50, 30]);
    await command(endpoint, "on");
    expect(timesOf(endpoint)).toEqual([true, 50, 30]);
    expect(calls).toEqual([
      "homeassistant.turn_on",
      "homeassistant.turn_off",
      "homeassistant.turn_on",
    ]);
  });
});
