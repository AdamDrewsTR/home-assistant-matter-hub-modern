import { createServer } from "node:http";
import type {
  EntityMappingConfig,
  EntityMappingRequest,
} from "@home-assistant-matter-hub/common";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { entityMappingApi } from "./entity-mapping-api.js";

const mappings = new Map<string, EntityMappingConfig>();
const setMapping = vi.fn(async (request: EntityMappingRequest) => {
  const { bridgeId: _, ...config } = request;
  mappings.set(config.entityId, config);
  return config;
});
const identityDelete = vi.fn();
const app = express();
app.use(express.json());
app.use(
  "/mappings",
  entityMappingApi(
    {
      getMappingsForBridge: () => [...mappings.values()],
      getMapping: (_, id) => mappings.get(id),
      setMapping,
      deleteMapping: vi.fn(),
      deleteBridgeMappings: vi.fn(),
    },
    { deleteBridgeIdentities: identityDelete },
  ),
);
const server = createServer(app);
let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address");
  base = `http://127.0.0.1:${address.port}/mappings/home`;
});
beforeEach(() => {
  mappings.clear();
  setMapping.mockClear();
  identityDelete.mockClear();
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);
function put(entityId: string, body: object) {
  return fetch(`${base}/${entityId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("conflict-safe bundle creation", () => {
  it("preserves deliberate shared companions on unrelated edits", async () => {
    const original = {
      entityId: "sensor.temperature",
      humidityEntity: "sensor.humidity",
    };
    mappings.set(original.entityId, original);
    mappings.set("fan.purifier", {
      entityId: "fan.purifier",
      humidityEntity: "sensor.humidity",
    });
    expect(
      (
        await put(original.entityId, {
          ...original,
          customName: "Room",
          expectedMapping: original,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await put(original.entityId, {
          ...mappings.get(original.entityId),
          expectedMapping: mappings.get(original.entityId),
          onlyIfUnmapped: true,
        })
      ).status,
    ).toBe(409);
  });
  it("guards existing edits against concurrent changes, including deletion", async () => {
    const original = { entityId: "sensor.temperature", customName: "Original" };
    mappings.set(original.entityId, {
      ...original,
      customName: "Changed remotely",
    });
    expect(
      (
        await put(original.entityId, {
          ...original,
          customName: "New",
          expectedMapping: original,
        })
      ).status,
    ).toBe(409);
    mappings.clear();
    expect(
      (await put(original.entityId, { ...original, expectedMapping: original }))
        .status,
    ).toBe(409);
    expect(setMapping).not.toHaveBeenCalled();
  });
  it("allows guarded unbundling while preserving unrelated companions and overrides", async () => {
    const original: EntityMappingConfig = {
      entityId: "sensor.temperature",
      customName: "Room",
      customSerialNumber: "existing-identity",
      faultEntity: "binary_sensor.fault",
      operationalStateEntity: "sensor.operational",
      composeDevice: true,
      composedEntities: [{ entityId: "sensor.humidity" }],
    };
    mappings.set(original.entityId, original);
    const { composedEntities: _, composeDevice: __, ...rest } = original;
    expect(
      (await put(original.entityId, { ...rest, expectedMapping: original }))
        .status,
    ).toBe(200);
    expect(mappings.get(original.entityId)).toMatchObject(rest);
    expect(mappings.get(original.entityId)?.composedEntities).toBeUndefined();
    expect(identityDelete).not.toHaveBeenCalled();
  });
  it("rejects acquiring another mapping's child during a guarded edit", async () => {
    const original = { entityId: "sensor.temperature", customName: "Room" };
    mappings.set(original.entityId, original);
    mappings.set("fan.purifier", {
      entityId: "fan.purifier",
      humidityEntity: "sensor.humidity",
    });
    expect(
      (
        await put(original.entityId, {
          ...original,
          composeDevice: true,
          composedEntities: [{ entityId: "sensor.humidity" }],
          expectedMapping: original,
        })
      ).status,
    ).toBe(409);
    expect(setMapping).not.toHaveBeenCalled();
  });
  it("accepts a fresh guarded creation but rejects a concurrently created mapping", async () => {
    expect(
      (
        await put("sensor.temperature", {
          customName: "Room",
          expectedMapping: null,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await put("sensor.temperature", {
          customName: "Overwrite",
          expectedMapping: null,
        })
      ).status,
    ).toBe(409);
    expect(setMapping).toHaveBeenCalledOnce();
  });
  const bundle = {
    composeDevice: true,
    composedEntities: [
      { entityId: "sensor.humidity", matterDeviceType: "humidity_sensor" },
    ],
    onlyIfUnmapped: true,
  };
  it("round-trips explicit composition and refuses overwriting an existing override", async () => {
    expect((await put("sensor.temperature", bundle)).status).toBe(200);
    expect(mappings.get("sensor.temperature")).toMatchObject({
      composeDevice: true,
      composedEntities: bundle.composedEntities,
    });
    expect((await put("sensor.temperature", bundle)).status).toBe(409);
    expect(setMapping).toHaveBeenCalledOnce();
    expect(identityDelete).not.toHaveBeenCalled();
  });
  it("rejects a child already owned by another mapping, including companion sensors", async () => {
    mappings.set("fan.purifier", {
      entityId: "fan.purifier",
      humidityEntity: "sensor.humidity",
      customName: "Preserved",
    });
    expect((await put("sensor.temperature", bundle)).status).toBe(409);
    expect(setMapping).not.toHaveBeenCalled();
    expect(mappings.get("fan.purifier")?.customName).toBe("Preserved");
  });
  it("keeps normal mapping edits available without deleting identities", async () => {
    mappings.set("sensor.temperature", {
      entityId: "sensor.temperature",
      customName: "Old",
    });
    expect(
      (await put("sensor.temperature", { customName: "New" })).status,
    ).toBe(200);
    expect(mappings.get("sensor.temperature")?.customName).toBe("New");
    expect(identityDelete).not.toHaveBeenCalled();
  });
  it("rejects malformed or self-referencing explicit compositions before saving", async () => {
    expect(
      (await put("sensor.temperature", { composeDevice: "true" })).status,
    ).toBe(400);
    expect(
      (
        await put("sensor.temperature", {
          composeDevice: true,
          composedEntities: [{ entityId: "sensor.temperature" }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await put("sensor.temperature", {
          composeDevice: true,
          composedEntities: [],
        })
      ).status,
    ).toBe(400);
    expect(setMapping).not.toHaveBeenCalled();
  });
});
