import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  BridgeData,
  HomeAssistantEntityState,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { type Endpoint, VendorId } from "@matter/main";
import { DeviceTypeConformanceService, ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../services/bridges/bridge-data-provider.js";
import { BridgeRegistry } from "../../services/bridges/bridge-registry.js";
import { EntityStateProvider } from "../../services/bridges/entity-state-provider.js";
import { HomeAssistantActions } from "../../services/home-assistant/home-assistant-actions.js";
import { HomeAssistantConfig } from "../../services/home-assistant/home-assistant-config.js";
import type { HomeAssistantRegistry } from "../../services/home-assistant/home-assistant-registry.js";
import { AggregatorEndpoint } from "./aggregator-endpoint.js";
import { UserComposedEndpoint } from "./composed/user-composed-endpoint.js";
import { duplicateNumberTags } from "./duplicate-tags.js";

// Base device type, Duplicate condition: siblings that share an application
// device type need a Descriptor TagList. matter.js only waives it for
// BridgedNode children of an Aggregator.

type Attrs = Record<string, unknown>;

function haRegistry(
  entities: [string, string, Attrs][],
): HomeAssistantRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: registry stub
  const reg: Record<string, any> = {};
  const states: Record<string, HomeAssistantEntityState> = {};
  for (const [id, state, attrs] of entities) {
    reg[id] = { entity_id: id, device_id: "dev1", unique_id: id };
    states[id] = {
      entity_id: id,
      state,
      attributes: { friendly_name: id, ...attrs },
      context: { id: "c" },
      last_changed: "2026-01-01T00:00:00",
      last_updated: "2026-01-01T00:00:00",
      // biome-ignore lint/suspicious/noExplicitAny: fixture
    } as any;
  }
  return {
    entities: reg,
    states,
    devices: {
      dev1: { id: "dev1", name: "Dev", manufacturer: "t", model: "m" },
    },
    labels: [],
    areas: new Map(),
    // biome-ignore lint/suspicious/noExplicitAny: registry stub
  } as any;
}

function bridgeData(id: string, flags: Record<string, boolean>): BridgeData {
  return {
    id,
    name: id,
    port: 0,
    filter: { include: [], exclude: [], includeMode: "any" },
    featureFlags: flags,
    basicInformation: {
      vendorId: 0xfff1,
      vendorName: "t",
      productId: 0x8000,
      productName: "t",
      productLabel: "t",
      hardwareVersion: 1,
      softwareVersion: 1,
    },
    // biome-ignore lint/suspicious/noExplicitAny: fixture
  } as any;
}

let dir: string;
let env: Environment;
let server: ServerNode | undefined;

function setup(ha: HomeAssistantRegistry, data: BridgeDataProvider) {
  env.set(BridgeDataProvider, data);
  env.set(EntityStateProvider, new EntityStateProvider(ha));
  return new BridgeRegistry(ha, data);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-tags-"));
  env = new Environment("tags", Environment.default);
  env.get(VariableService).set("storage.path", dir);
  env.set(HomeAssistantActions, {
    call() {},
    fireEvent() {},
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
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

function tagOf(endpoint: Endpoint) {
  // biome-ignore lint/suspicious/noExplicitAny: read descriptor state
  return (endpoint.state as any).descriptor.tagList?.map(
    (t: { namespaceId: number; tag: number }) => [t.namespaceId, t.tag],
  );
}

function tagListViolations(node: ServerNode) {
  const verdict = node.env
    .get(DeviceTypeConformanceService)
    .validateNodeScope(node, { refuse: false });
  return [...verdict].flatMap(([endpoint, list]) =>
    list
      .filter((v) => v.requirement.includes("TAGLIST"))
      .map((v) => `${endpoint.id} ${v.deviceType} ${v.requirement}`),
  );
}

async function mount(composed: Endpoint) {
  server = await ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: env as any,
    id: "tags-composed",
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  await aggregator.add(composed);
  return [...composed.parts].map((p) => [p.id, tagOf(p)]);
}

const temperature = { device_class: "temperature", unit_of_measurement: "°C" };

describe("duplicate sibling TagList", () => {
  it("numbers same type parts of a user composed device (#408)", async () => {
    const ha = haRegistry([
      ["sensor.t1", "21", temperature],
      ["sensor.t2", "22", temperature],
      ["sensor.lux", "42", { device_class: "illuminance" }],
    ]);
    const registry = setup(
      ha,
      new BridgeDataProvider(bridgeData("c", { autoComposedDevices: true })),
    );
    const composed = await UserComposedEndpoint.create({
      registry,
      primaryEntityId: "sensor.t1",
      mapping: { entityId: "sensor.t1" },
      composedEntities: [
        { entityId: "sensor.t2", matterDeviceType: "temperature_sensor" },
        { entityId: "sensor.lux", matterDeviceType: "light_sensor" },
      ],
    });
    expect(composed).toBeDefined();
    expect(await mount(composed!)).toEqual([
      ["sensor_t1_primary", [[7, 1]]],
      ["sensor_t1_sub_0", [[7, 2]]],
      ["sensor_t1_sub_1", undefined],
    ]);
    expect(tagListViolations(server!)).toEqual([]);
  });

  it("counts a device type a part only lists in its deviceTypeList", async () => {
    const ha = haRegistry([
      ["switch.m", "on", {}],
      ["switch.p", "off", {}],
      ["sensor.lux", "42", { device_class: "illuminance" }],
    ]);
    const registry = setup(
      ha,
      new BridgeDataProvider(bridgeData("c", { autoComposedDevices: true })),
    );
    // mounted on/off control lists 0x010F and 0x010A, the plain switch is 0x010A
    const composed = await UserComposedEndpoint.create({
      registry,
      primaryEntityId: "switch.m",
      mapping: {
        entityId: "switch.m",
        matterDeviceType: "mounted_on_off_control",
      },
      composedEntities: [
        { entityId: "switch.p" },
        { entityId: "sensor.lux", matterDeviceType: "light_sensor" },
      ],
    });
    expect(composed).toBeDefined();
    expect(await mount(composed!)).toEqual([
      ["switch_m_primary", [[7, 1]]],
      ["switch_m_sub_0", [[7, 2]]],
      ["switch_m_sub_1", undefined],
    ]);
    expect(tagListViolations(server!)).toEqual([]);
  });

  it("keeps the solar Grid tag next to the Number tag", async () => {
    const power = { device_class: "power", unit_of_measurement: "W" };
    const ha = haRegistry([
      ["sensor.s1", "100", power],
      ["sensor.s2", "200", power],
    ]);
    const registry = setup(
      ha,
      new BridgeDataProvider(bridgeData("c", { autoComposedDevices: true })),
    );
    const composed = await UserComposedEndpoint.create({
      registry,
      primaryEntityId: "sensor.s1",
      mapping: { entityId: "sensor.s1", matterDeviceType: "solar_power" },
      composedEntities: [
        { entityId: "sensor.s2", matterDeviceType: "solar_power" },
      ],
    });
    expect(composed).toBeDefined();
    // Power Source namespace 0x0F, Grid 0x01
    expect(await mount(composed!)).toEqual([
      [
        "sensor_s1_primary",
        [
          [0x0f, 1],
          [7, 1],
        ],
      ],
      [
        "sensor_s1_sub_0",
        [
          [0x0f, 1],
          [7, 2],
        ],
      ],
    ]);
    expect(tagListViolations(server!)).toEqual([]);
  });
});

describe("duplicateNumberTags", () => {
  const TEMPERATURE = 0x0302;
  const HUMIDITY = 0x0307;
  const LIGHT = 0x0100;
  const LOCK = 0x000a;
  const part = (...types: number[]) =>
    ({
      type: { deviceType: types[0] },
      behaviors: {
        supported: {
          descriptor: {
            defaults: {
              deviceTypeList: types.map((deviceType) => ({ deviceType })),
            },
          },
        },
      },
    }) as unknown as Endpoint;
  const numbers = (parts: Endpoint[]) => {
    const tags = duplicateNumberTags(parts);
    return parts.map((p) => tags.get(p));
  };

  it("counts each device type from One", () => {
    expect(numbers([part(LIGHT), part(LOCK), part(LIGHT), part(LOCK)])).toEqual(
      [1, 1, 2, 2],
    );
  });

  it("gives a part in two duplicated types a number free in both", () => {
    expect(
      numbers([
        part(HUMIDITY),
        part(HUMIDITY),
        part(TEMPERATURE),
        part(TEMPERATURE, HUMIDITY),
      ]),
    ).toEqual([1, 2, 1, 3]);
  });

  it("leaves duplicates past Thirty untagged", () => {
    const tags = numbers(Array.from({ length: 31 }, () => part(LIGHT)));
    expect(tags.slice(28)).toEqual([29, 30, undefined]);
  });
});
