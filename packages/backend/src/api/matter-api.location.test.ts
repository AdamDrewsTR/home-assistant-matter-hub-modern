import { createServer } from "node:http";
import type { HomeAssistantFilter } from "@home-assistant-matter-hub/common";
import express from "express";
import { afterAll, beforeAll, expect, it } from "vitest";
import { BridgeDataProvider } from "../services/bridges/bridge-data-provider.js";
import { BridgeRegistry } from "../services/bridges/bridge-registry.js";
import type { BridgeService } from "../services/bridges/bridge-service.js";
import type { HomeAssistantRegistry } from "../services/home-assistant/home-assistant-registry.js";
import { matterApi } from "./matter-api.js";

const ha = {
  entities: {
    "light.desk": {
      entity_id: "light.desk",
      device_id: "desk",
      area_id: "hall",
    },
    "sensor.disabled": {
      entity_id: "sensor.disabled",
      device_id: "desk",
      disabled_by: "user",
    },
    "sensor.standalone": {
      entity_id: "sensor.standalone",
      device_id: "",
      area_id: "hall",
    },
  },
  devices: { desk: { id: "desk", area_id: "office" } },
  states: {},
  labels: [],
  areas: new Map([
    ["office", "Office"],
    ["hall", "Hall"],
  ]),
  areaRegistry: [
    { area_id: "office", name: "Office", floor_id: "upstairs" },
    { area_id: "hall", name: "Hall", floor_id: "downstairs" },
  ],
  floors: [{ floor_id: "upstairs", name: "Upstairs" }],
} as unknown as HomeAssistantRegistry;
const filter: HomeAssistantFilter = {
  include: [],
  exclude: [],
  location: {
    areaIds: [],
    floorIds: ["upstairs"],
    excludedDeviceIds: [],
    excludedEntityIds: [],
  },
};
const app = express();
app.use(express.json());
app.use(matterApi({ bridges: [] } as unknown as BridgeService, ha));
const server = createServer(app);
let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);
async function preview(body: unknown) {
  return fetch(`${base}/filter-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("returns floor metadata and previews the same whole-device membership as the live registry", async () => {
  expect(await (await fetch(`${base}/locations`)).json()).toEqual({
    areas: ha.areaRegistry,
    floors: ha.floors,
  });
  const provider = new BridgeDataProvider({
    id: "home",
    name: "Home",
    port: 5540,
    filter,
    basicInformation: {
      vendorId: 1,
      vendorName: "Test",
      productId: 1,
      productName: "Test",
      productLabel: "Test",
      hardwareVersion: 1,
      softwareVersion: 1,
    },
  });
  const registry = new BridgeRegistry(ha, provider);
  registry.refresh();
  const response = await preview(filter);
  expect(response.status).toBe(200);
  expect((await response.json()).entityIds).toEqual(registry.entityIds);
  expect(registry.entityIds).toEqual(["light.desk"]);
});

it("rejects malformed or unknown location settings instead of broadening the filter", async () => {
  for (const location of [
    { floorIds: ["upstairs"] },
    { ...filter.location, excludedEntityIds: "light.desk" },
    { ...filter.location, areaIds: ["office", "office"] },
    { ...filter.location, includeHidden: true },
  ])
    expect((await preview({ ...filter, location })).status).toBe(400);
});

it("fails closed for empty or deleted locations", async () => {
  for (const floorIds of [[], ["deleted"]]) {
    const response = await preview({
      ...filter,
      location: { ...filter.location, floorIds },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).entityIds).toEqual([]);
  }
});
