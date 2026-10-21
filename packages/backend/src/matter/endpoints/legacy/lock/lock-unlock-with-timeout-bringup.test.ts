import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { Endpoint, VendorId } from "@matter/main";
import { DoorLock } from "@matter/main/clusters";
import { ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../../../services/bridges/bridge-data-provider.js";
import {
  type HomeAssistantAction,
  HomeAssistantActions,
} from "../../../../services/home-assistant/home-assistant-actions.js";
import { AggregatorEndpoint } from "../../aggregator-endpoint.js";
import { LockDevice } from "./index.js";

// UnlockWithTimeout used to be left to matter.js, which flipped lockState to
// Unlocked without calling HA. It now unlocks like UnlockDoor and relocks
// through HA once the timeout is up.

let dir: string;
let calls: string[];
const servers: ServerNode[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-lock-uwt-"));
  calls = [];
});

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.close().catch(() => {});
  }
  rmSync(dir, { recursive: true, force: true });
});

function makeEnv(): Environment {
  const env = new Environment("test", Environment.default);
  env.get(VariableService).set("storage.path", dir);
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
  return env;
}

function lockEntity(supportedFeatures: number): HomeAssistantEntityInformation {
  const state = {
    entity_id: "lock.front_door",
    state: "locked",
    attributes: {
      friendly_name: "Front Door",
      supported_features: supportedFeatures,
    },
    context: { id: "ctx" },
    last_changed: "2026-01-01T00:00:00",
    last_updated: "2026-01-01T00:00:00",
  };
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  return { entity_id: "lock.front_door", state: state as any };
}

const noPin: EntityMappingConfig = {
  entityId: "lock.front_door",
  lockWithoutPin: true,
};

async function mount(mapping?: EntityMappingConfig, supportedFeatures = 0) {
  const server = await ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: makeEnv() as any,
    id: "lock-uwt-node",
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });
  servers.push(server);
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  const endpoint = new Endpoint(
    LockDevice({
      entity: lockEntity(supportedFeatures),
      mapping,
    } as never),
    { id: "lock" },
  );
  await aggregator.add(endpoint);
  const command = (name: string, request: object = {}) =>
    endpoint.act(async (agent) => {
      // biome-ignore lint/suspicious/noExplicitAny: invoke the door lock command
      await (agent as any).doorLock[name](request);
    });
  // biome-ignore lint/suspicious/noExplicitAny: inspect cluster state
  const lockState = () => (endpoint.state as any).doorLock.lockState;
  return { server, command, lockState };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("UnlockWithTimeout", () => {
  it("unlocks through HA and relocks after the timeout", async () => {
    for (const [mapping, features, unlock] of [
      [undefined, 0, "lock.unlock"],
      [undefined, 1, "lock.open"],
      [noPin, 0, "lock.unlock"],
      [noPin, 1, "lock.open"],
    ] as const) {
      calls = [];
      const { server, command, lockState } = await mount(mapping, features);
      await command("unlockWithTimeout", { timeout: 1 });
      expect(calls).toEqual([unlock]);
      // Only HA moves the state, it has not reported anything yet.
      expect(lockState()).toBe(DoorLock.LockState.Locked);
      await expect
        .poll(() => calls, { timeout: 3000 })
        .toEqual([unlock, "lock.lock"]);
      await server.close();
    }
  }, 30_000);

  it("drops the relock on a later command and on close", async () => {
    const first = await mount();
    await first.command("unlockWithTimeout", { timeout: 1 });
    await first.command("unlockDoor");
    await sleep(1500);
    expect(calls).toEqual(["lock.unlock", "lock.unlock"]);
    await first.server.close();

    calls = [];
    const second = await mount();
    await second.command("unlockWithTimeout", { timeout: 1 });
    await second.server.close();
    await sleep(1500);
    expect(calls).toEqual(["lock.unlock"]);
  }, 30_000);
});
