import type {
  HomeAssistantEntityRegistry,
  HomeAssistantEntityState,
  LocationSharing,
} from "@home-assistant-matter-hub/common";
import { expect, it } from "vitest";
import type { HomeAssistantRegistry } from "../home-assistant/home-assistant-registry.js";
import { BridgeDataProvider } from "./bridge-data-provider.js";
import { BridgeRegistry } from "./bridge-registry.js";

it("reconciles location membership and prevents companion mappings from bypassing exclusions", () => {
  const location: LocationSharing = {
    areaIds: ["office"],
    floorIds: [],
    excludedDeviceIds: [],
    excludedEntityIds: ["sensor.humidity"],
  };
  const entities: Record<string, HomeAssistantEntityRegistry> = {
    "sensor.temperature": {
      entity_id: "sensor.temperature",
      device_id: "monitor",
      area_id: "hall",
    },
    "sensor.humidity": { entity_id: "sensor.humidity", device_id: "monitor" },
  };
  const states: Record<string, HomeAssistantEntityState> = Object.fromEntries(
    Object.keys(entities).map((entity_id) => [
      entity_id,
      {
        entity_id,
        state: "unavailable",
        attributes: { device_class: entity_id.split(".")[1] },
        context: { id: "ctx" },
        last_changed: "",
        last_updated: "",
      },
    ]),
  );
  const ha = {
    entities,
    states,
    devices: { monitor: { id: "monitor", area_id: "office" } },
    areaRegistry: [
      { area_id: "office", name: "Office" },
      { area_id: "hall", name: "Hall" },
    ],
    labels: [],
    areas: new Map(),
  } as unknown as HomeAssistantRegistry;
  const provider = new BridgeDataProvider({
    id: "home",
    name: "Home",
    port: 5540,
    filter: { include: [], exclude: [], location },
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
  expect(registry.entity("sensor.temperature")).toBeDefined();
  expect(registry.entity("sensor.humidity")).toBeUndefined();
  expect(registry.findHumidityEntityForDevice("monitor")).toBeUndefined();
  expect(registry.entityIncludingUnfiltered("sensor.humidity")).toBeUndefined();
  expect(
    registry.initialStateIncludingUnfiltered("sensor.humidity"),
  ).toBeUndefined();
  location.excludedEntityIds = [];
  registry.refresh();
  expect(registry.findHumidityEntityForDevice("monitor")).toBe(
    "sensor.humidity",
  );
  ha.devices.monitor.area_id = "hall";
  registry.refresh();
  expect(registry.entity("sensor.temperature")).toBeUndefined();
});
