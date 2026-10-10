import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type HomeAssistantEntityInformation,
  MediaPlayerDeviceClass,
  MediaPlayerDeviceFeature,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { Endpoint, VendorId } from "@matter/main";
import { MediaPlayback } from "@matter/main/clusters";
import { ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../../../services/bridges/bridge-data-provider.js";
import { AggregatorEndpoint } from "../../aggregator-endpoint.js";
import { MediaPlayerDevice } from "./index.js";

let dir: string;
let env: Environment;
let server: ServerNode | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-tv-"));
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
});

afterEach(async () => {
  await server?.close().catch(() => {});
  server = undefined;
  rmSync(dir, { recursive: true, force: true });
});

function tvEntity(supported_features: number): HomeAssistantEntityInformation {
  const state = {
    entity_id: "media_player.tv",
    state: "on",
    attributes: {
      friendly_name: "TV",
      device_class: MediaPlayerDeviceClass.Tv,
      supported_features,
      source_list: ["HDMI 1", "HDMI 2"],
      source: "HDMI 1",
    },
    context: { id: "ctx" },
    last_changed: "2026-01-01T00:00:00",
    last_updated: "2026-01-01T00:00:00",
  };
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  return { entity_id: "media_player.tv", state: state as any };
}

describe("tv media_player bring-up", () => {
  it("mounts a TV that only supports source selection", async () => {
    server = await ServerNode.create({
      // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
      environment: env as any,
      id: "tv-node",
      network: { port: 0 },
      commissioning: { passcode: 20202021, discriminator: 3840 },
      basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
    });
    const aggregator = new AggregatorEndpoint("aggregator");
    await server.add(aggregator);
    const endpoint = new Endpoint(
      MediaPlayerDevice({
        entity: tvEntity(MediaPlayerDeviceFeature.SELECT_SOURCE),
      } as never),
      { id: "tv" },
    );
    await aggregator.add(endpoint);
    // biome-ignore lint/suspicious/noExplicitAny: inspect cluster state
    expect((endpoint.state as any).mediaPlayback.currentState).toBe(
      MediaPlayback.PlaybackState.NotPlaying,
    );
  });
});
