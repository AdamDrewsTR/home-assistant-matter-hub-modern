import { describe, expect, it } from "vitest";
import type { HomeEntity } from "../../api/home-inventory.ts";
import { groupHomeDevices } from "./device-groups.ts";

describe("HA physical device grouping", () => {
  it("keeps entity area overrides on the same physical device card in the device's room", () => {
    const entities: HomeEntity[] = [
      {
        entity_id: "sensor.temperature",
        domain: "sensor",
        state: "21",
        device_id: "monitor",
        device_name: "Room monitor",
        device_area_id: "bedroom",
        area_id: "office",
      },
      {
        entity_id: "sensor.humidity",
        domain: "sensor",
        state: "40",
        device_id: "monitor",
        device_name: "Room monitor",
        device_area_id: "bedroom",
        area_id: "bedroom",
      },
    ];
    expect(groupHomeDevices(entities)).toEqual([
      expect.objectContaining({
        id: "device:monitor",
        name: "Room monitor",
        areaId: "bedroom",
        entities: expect.arrayContaining(entities),
      }),
    ]);
  });
  it("does not turn unrelated scenes and helpers of one domain into a fake device", () => {
    const groups = groupHomeDevices([
      {
        entity_id: "scene.dinner",
        domain: "scene",
        state: "unknown",
        friendly_name: "Dinner",
      },
      {
        entity_id: "scene.movie",
        domain: "scene",
        state: "unknown",
        friendly_name: "Movie",
      },
    ]);
    expect(groups.map((group) => group.name)).toEqual(["Dinner", "Movie"]);
    expect(groups.every((group) => group.entities.length === 1)).toBe(true);
  });
});
