import { createServer } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { homeAssistantApi } from "./home-assistant-api.js";

const app = express();
app.use(
  "/api/home-assistant",
  homeAssistantApi(
    {
      entities: {
        "light.inherited": { entity_id: "light.inherited", device_id: "lamp" },
        "light.override": {
          entity_id: "light.override",
          device_id: "lamp",
          area_id: "office",
        },
        "sensor.diagnostic": {
          entity_id: "sensor.diagnostic",
          device_id: "lamp",
          disabled_by: "user",
          hidden_by: "integration",
          entity_category: "diagnostic",
        },
        "switch.unknown_area": {
          entity_id: "switch.unknown_area",
          device_id: "other",
        },
      },
      devices: {
        lamp: {
          id: "lamp",
          name: "Factory name",
          name_by_user: "Desk lights",
          area_id: "living_room",
          manufacturer: "Demo",
          model: "Light",
        },
        other: { id: "other", area_id: 123 },
      },
      states: {},
      reload: vi.fn(),
    },
    { connection: undefined },
  ),
);
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

describe("home inventory metadata", () => {
  it("uses HA room overrides and user-assigned device names for the picker", async () => {
    const response = await fetch(
      `${base}/api/home-assistant/entities?limit=500`,
    );
    const body = await response.json();
    expect(response.ok).toBe(true);
    expect(body.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_id: "light.inherited",
          area_id: "living_room",
          device_name: "Desk lights",
          device_area_id: "living_room",
          manufacturer: "Demo",
          model: "Light",
        }),
        expect.objectContaining({
          entity_id: "light.override",
          area_id: "office",
        }),
        expect.objectContaining({
          entity_id: "sensor.diagnostic",
          disabled: true,
          hidden: true,
          entity_category: "diagnostic",
        }),
      ]),
    );
    const unknown = body.entities.find(
      (entity: { entity_id: string }) =>
        entity.entity_id === "switch.unknown_area",
    );
    expect(unknown).not.toHaveProperty("area_id");
  });
});
