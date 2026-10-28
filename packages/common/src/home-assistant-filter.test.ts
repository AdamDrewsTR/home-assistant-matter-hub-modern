import { describe, expect, it } from "vitest";
import {
  type LocationSharing,
  matchesLocationSharing,
} from "./home-assistant-filter.js";

const location: LocationSharing = {
  areaIds: ["office"],
  floorIds: [],
  excludedDeviceIds: [],
  excludedEntityIds: [],
};
const entity = {
  entity_id: "sensor.temperature",
  device_id: "monitor",
  area_id: "hall",
};
const device = { id: "monitor", area_id: "office" };
const areas = [
  { area_id: "office", name: "Office", floor_id: "upstairs" },
  { area_id: "hall", name: "Hall", floor_id: "downstairs" },
];

describe("location sharing", () => {
  it("keeps all eligible entities with the physical device despite entity room overrides", () => {
    expect(matchesLocationSharing(location, entity, device, areas)).toBe(true);
    expect(
      matchesLocationSharing(
        { ...location, areaIds: ["hall"] },
        entity,
        device,
        areas,
      ),
    ).toBe(false);
    expect(
      matchesLocationSharing(
        location,
        { ...entity, entity_id: "switch.new_control" },
        device,
        areas,
      ),
    ).toBe(true);
  });
  it("follows floor membership and device moves without rewriting the rule", () => {
    const floor = { ...location, areaIds: [], floorIds: ["upstairs"] };
    expect(matchesLocationSharing(floor, entity, device, areas)).toBe(true);
    expect(
      matchesLocationSharing(
        floor,
        entity,
        { ...device, area_id: "hall" },
        areas,
      ),
    ).toBe(false);
    expect(
      matchesLocationSharing(
        floor,
        entity,
        device,
        areas.map((area) => ({ ...area, floor_id: "downstairs" })),
      ),
    ).toBe(false);
    expect(
      matchesLocationSharing(
        floor,
        { ...entity, device_id: "future" },
        { id: "future", area_id: "future-room" },
        [
          ...areas,
          { area_id: "future-room", name: "New room", floor_id: "upstairs" },
        ],
      ),
    ).toBe(true);
  });
  it("falls back to the entity room for unassigned devices and standalone entities", () => {
    const hall = { ...location, areaIds: ["hall"] };
    expect(matchesLocationSharing(hall, entity, undefined, areas)).toBe(true);
    expect(matchesLocationSharing(hall, entity, { id: "monitor" }, areas)).toBe(
      true,
    );
    expect(
      matchesLocationSharing(location, entity, { id: "monitor" }, areas),
    ).toBe(false);
  });
  it("fails closed for empty or deleted locations, but not unavailable entities", () => {
    expect(
      matchesLocationSharing(
        { ...location, areaIds: [] },
        entity,
        device,
        areas,
      ),
    ).toBe(false);
    expect(matchesLocationSharing(location, entity, device, [])).toBe(false);
    expect(matchesLocationSharing(location, entity, device, areas)).toBe(true);
  });
  it("retains exclusions for every current and future device entity and honors explicit entity exceptions", () => {
    const excluded = { ...location, excludedDeviceIds: ["monitor"] };
    expect(matchesLocationSharing(excluded, entity, device, areas)).toBe(false);
    expect(
      matchesLocationSharing(
        excluded,
        { ...entity, entity_id: "light.future" },
        device,
        areas,
      ),
    ).toBe(false);
    expect(
      matchesLocationSharing(
        { ...location, excludedEntityIds: [entity.entity_id] },
        entity,
        device,
        areas,
      ),
    ).toBe(false);
  });
  it("always excludes hidden/disabled entities and requires opt-in for diagnostic/configuration entities", () => {
    for (const flags of [
      { hidden_by: "user" },
      { disabled_by: "integration" },
    ]) {
      expect(
        matchesLocationSharing(
          { ...location, includeDiagnosticEntities: true },
          { ...entity, ...flags },
          device,
          areas,
        ),
      ).toBe(false);
    }
    for (const entity_category of ["diagnostic", "config"]) {
      expect(
        matchesLocationSharing(
          location,
          { ...entity, entity_category },
          device,
          areas,
        ),
      ).toBe(false);
      expect(
        matchesLocationSharing(
          { ...location, includeDiagnosticEntities: true },
          { ...entity, entity_category },
          device,
          areas,
        ),
      ).toBe(true);
    }
  });
});
