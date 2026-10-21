import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { ControllerBehavior, Endpoint, VendorId } from "@matter/main";
import { OnOff } from "@matter/main/clusters";
import { DeviceTypeConformanceService, ServerNode } from "@matter/main/node";
import { Invoke } from "@matter/main/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../../../services/bridges/bridge-data-provider.js";
import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../../../services/home-assistant/home-assistant-actions.js";
import { AggregatorEndpoint } from "../../aggregator-endpoint.js";
import { asStandaloneEndpointType } from "../../standalone-endpoint-type.js";
import { createLegacyEndpointType } from "../create-legacy-endpoint-type.js";

// OnOffPlugInUnit and DimmableLight require the OnOff Lighting feature. On
// these endpoints an off can disarm an alarm or close a cover, so the extra
// Lighting commands must never fire an HA call later on their own.

let dir: string;
let env: Environment;
let calls: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-plug-lt-"));
  env = new Environment("test", Environment.default);
  env.get(VariableService).set("storage.path", dir);
  calls = [];
  env.set(HomeAssistantActions, {
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

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Shape = [string, string, Record<string, unknown>?, object?];
const asPlug = { matterDeviceType: "on_off_plugin_unit" };

const shapes: Shape[] = [
  ["switch.plain", "on"],
  ["input_boolean.ib", "on"],
  ["light.asplug", "on", { supported_color_modes: ["onoff"] }, asPlug],
  ["valve.asplug", "open", {}, asPlug],
  ["alarm_control_panel.asplug", "disarmed", { supported_features: 2 }, asPlug],
  ["script.s", "off"],
  ["scene.sc", "2026-01-01T00:00:00"],
  ["automation.a", "on"],
  ["input_button.ib", "2026-01-01T00:00:00"],
  ["button.b", "2026-01-01T00:00:00"],
  ["remote.r", "on"],
  ["siren.si", "off"],
  ["fan.onoff", "on", { supported_features: 48 }],
  ["fan.onoffbat", "on", { supported_features: 48, battery_level: 80 }],
  [
    "select.selsw",
    "a",
    { options: ["a", "b"] },
    {
      selectExposeAsSwitch: true,
      selectSwitchOnOption: "a",
      selectSwitchOffOption: "b",
    },
  ],
  [
    "cover.aslight",
    "open",
    { supported_features: 15, current_position: 50 },
    { coverExposeAsDimmableLight: true },
  ],
];

function typeOf([entityId, state, attributes = {}, mapping]: Shape) {
  const entity = {
    entity_id: entityId,
    state: {
      entity_id: entityId,
      state,
      attributes: { friendly_name: entityId, ...attributes },
      context: { id: "ctx" },
      last_changed: "2026-01-01T00:00:00",
      last_updated: "2026-01-01T00:00:00",
    },
  } as HomeAssistantEntityInformation;
  const type = createLegacyEndpointType(entity, {
    entityId,
    ...mapping,
  } as EntityMappingConfig);
  if (!type) throw new Error(`no endpoint type for ${entityId}`);
  return type;
}

const shape = (entityId: string) => {
  const found = shapes.find(([id]) => id === entityId);
  if (!found) throw new Error(entityId);
  return found;
};

const createNode = (id: string) =>
  ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: env as any,
    id,
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });

async function bridged(entityIds: string[]) {
  const server = await createNode("plug-lt-node");
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  const endpoints = new Map<string, Endpoint>();
  for (const entityId of entityIds) {
    const endpoint = new Endpoint(typeOf(shape(entityId)), {
      id: entityId.replace(".", "_"),
    });
    await aggregator.add(endpoint);
    endpoints.set(entityId, endpoint);
  }
  return { server, endpoints };
}

async function command(endpoint: Endpoint, name: string, request?: object) {
  await endpoint.act(async (agent) => {
    // biome-ignore lint/suspicious/noExplicitAny: drive the cluster
    await (agent as any).onOff[name](request);
  });
}

const timedOn = {
  onOffControl: { acceptOnlyWhenOn: false },
  onTime: 2,
  offWaitTime: 0,
};

describe("OnOff Lighting on plug type endpoints", () => {
  it("advertises Lighting and has no OnOff device type violation", async () => {
    const { server, endpoints } = await bridged(shapes.map(([id]) => id));
    const verdict = server.env
      .get(DeviceTypeConformanceService)
      .validateNodeScope(server, { refuse: false });
    const result = new Map<string, unknown>();
    for (const [entityId, endpoint] of endpoints) {
      let lighting: boolean | undefined;
      await endpoint.act((agent) => {
        // biome-ignore lint/suspicious/noExplicitAny: read runtime state
        lighting = (agent as any).onOff.state.featureMap.lighting;
      });
      const onOff = (verdict.get(endpoint) ?? [])
        .filter((v) => v.requirement.startsWith("OnOff"))
        .map((v) => `${v.deviceType} ${v.requirement}`);
      result.set(entityId, { lighting, onOff });
    }
    await server.close().catch(() => {});

    for (const [entityId] of shapes) {
      expect(result.get(entityId), entityId).toEqual({
        lighting: true,
        onOff: [],
      });
    }
  });

  it("turns on only from off and never fires the off after a timed on", async () => {
    const ids = [
      "alarm_control_panel.asplug",
      "cover.aslight",
      "switch.plain",
      "script.s",
      "button.b",
    ];
    const { server, endpoints } = await bridged(ids);
    for (const entityId of ids) {
      await command(endpoints.get(entityId)!, "onWithTimedOff", {
        ...timedOn,
        onOffControl: { acceptOnlyWhenOn: true },
      });
    }
    const onlyWhenOn = [...calls];
    for (const entityId of ids) {
      await command(endpoints.get(entityId)!, "onWithTimedOff", timedOn);
    }
    // OnTime 2 is 200 ms, give the matter.js countdown time to run out.
    await delay(700);
    await server.close().catch(() => {});

    expect(onlyWhenOn).toEqual([]);
    // The switch and the cover are already on.
    expect(calls.sort()).toEqual([
      "alarm_control_panel.alarm_arm_away",
      "button.press",
      "script.turn_on",
    ]);
  });

  // matter.js only stores and recalls the global scene for a remote
  // controller, so this one pairs a controller over loopback.
  it(
    "makes one plain HA call per Lighting command from a controller",
    { timeout: 120_000 },
    async () => {
      const ids = [
        "switch.plain",
        "cover.aslight",
        "alarm_control_panel.asplug",
      ];
      const { server, endpoints } = await bridged(ids);
      await server.start();
      // biome-ignore lint/suspicious/noExplicitAny: read runtime state
      const port = (server.state as any).network.operationalPort as number;
      const controller = await ServerNode.create(
        ServerNode.RootEndpoint.with(ControllerBehavior),
        {
          // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
          environment: env as any,
          id: "plug-lt-controller",
          network: { port: 0 },
          basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8001 },
        },
      );
      const effect = { effectIdentifier: 0, effectVariant: 0 };
      const steps: Array<[string, object?]> = [
        ["onWithRecallGlobalScene"],
        // Stores the global scene in matter.js.
        ["offWithEffect", effect],
        // Without the override matter.js would recall it and turn on twice.
        ["onWithRecallGlobalScene"],
        // Already on, only the timer would change.
        [
          "onWithTimedOff",
          { ...timedOn, onOffControl: { acceptOnlyWhenOn: true } },
        ],
        ["offWithEffect", effect],
        ["on"],
        // On set GlobalSceneControl, so this one is discarded.
        ["onWithRecallGlobalScene"],
      ];
      const result: Record<string, string[]> = {};
      try {
        await controller.start();
        const client = await controller.peers.forDescriptor({
          addresses: [{ type: "udp", ip: "127.0.0.1", port }],
          deviceIdentifier: "plug-lt",
          D: 3840,
          CM: 1,
          // biome-ignore lint/suspicious/noExplicitAny: matter.js client API is loosely typed
        } as any);
        await client.commission({
          passcode: 20202021,
          discriminator: 3840,
          autoSubscribe: false,
          autoStateInitialize: false,
        });
        for (const entityId of ids) {
          const endpoint = endpoints.get(entityId)!.number;
          result[entityId] = [];
          for (const [name, fields] of steps) {
            calls.length = 0;
            const status: unknown[] = [];
            const response = client.interaction.invoke(
              Invoke({
                commands: [
                  // biome-ignore lint/suspicious/noExplicitAny: matter.js client API is loosely typed
                  { endpoint, cluster: OnOff, command: name, fields } as any,
                ],
              }),
            );
            for await (const chunk of response) {
              for (const entry of chunk) {
                if (entry.kind === "cmd-status") status.push(entry.status);
              }
            }
            result[entityId].push(`${status} ${calls}`);
          }
        }
      } finally {
        await controller.close().catch(() => {});
        await server.close().catch(() => {});
      }

      const expected = (on: string, off: string) =>
        [on, off, on, "", off, on, ""].map((call) => `0 ${call}`);
      expect(result).toEqual({
        "switch.plain": expected(
          "homeassistant.turn_on",
          "homeassistant.turn_off",
        ),
        "cover.aslight": expected("cover.open_cover", "cover.close_cover"),
        "alarm_control_panel.asplug": expected(
          "alarm_control_panel.alarm_arm_away",
          "alarm_control_panel.alarm_disarm",
        ),
      });
    },
  );

  it("a StartUpOnOff written before a restart sends nothing to HA", async () => {
    // Server mode shape: matter.js only applies StartUpOnOff outside an
    // aggregator. HA says disarmed / on, StartUpOnOff says on / off. Own
    // entity ids, the optimistic onOff map outlives the other tests.
    const cases: Array<[Shape, number, boolean]> = [
      [["alarm_control_panel.restart", "disarmed", {}, asPlug], 1, false],
      [["switch.restart", "on"], 0, true],
    ];
    const mount = async () => {
      const server = await createNode("plug-lt-standalone");
      const endpoints = [];
      for (const [s] of cases) {
        const endpoint = new Endpoint(asStandaloneEndpointType(typeOf(s)), {
          id: s[0].replace(".", "_"),
        });
        await server.add(endpoint);
        endpoints.push(endpoint);
      }
      return { server, endpoints };
    };

    const first = await mount();
    for (const [i, [, startUpOnOff]] of cases.entries()) {
      await first.endpoints[i].act((agent) => {
        // biome-ignore lint/suspicious/noExplicitAny: controller write
        (agent as any).onOff.state.startUpOnOff = startUpOnOff;
      });
    }
    await first.server.close();

    const second = await mount();
    const after: Array<[number, boolean]> = [];
    for (const endpoint of second.endpoints) {
      await endpoint.act((agent) => {
        // biome-ignore lint/suspicious/noExplicitAny: read runtime state
        const { startUpOnOff, onOff } = (agent as any).onOff.state;
        after.push([startUpOnOff, onOff]);
      });
    }
    await second.server.close().catch(() => {});

    expect(calls).toEqual([]);
    expect(after).toEqual(cases.map(([, s, onOff]) => [s, onOff]));
  });
});
