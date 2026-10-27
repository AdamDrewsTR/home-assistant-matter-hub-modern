import { describe, expect, it } from "vitest";
import type { HomeEntity } from "../../api/home-inventory.ts";
import { mappingChanges, selectionChanges } from "./ChangePlan.tsx";
import { capabilityType, deviceIssues } from "./capabilities.ts";

function entity(id: string, deviceClass: string, state = "20"): HomeEntity {
  return {
    entity_id: id,
    domain: id.split(".")[0],
    state,
    attributes: { device_class: deviceClass },
  };
}
describe("inventory capability guidance", () => {
  it("discovers smoke, CO, air quality, pollutants and energy without relying on names", () => {
    expect(capabilityType(entity("binary_sensor.alarm", "smoke"))).toBe(
      "smoke_co_alarm",
    );
    expect(capabilityType(entity("sensor.air", "carbon_monoxide"))).toBe(
      "carbon_monoxide_sensor",
    );
    expect(capabilityType(entity("sensor.air", "aqi"))).toBe(
      "air_quality_sensor",
    );
    expect(capabilityType(entity("sensor.dust", "pm25"))).toBe("pm25_sensor");
    expect(capabilityType(entity("sensor.usage", "energy"))).toBe(
      "electrical_meter",
    );
  });
  it("respects configured appliance overrides and leaves unknown/plugin capabilities unclassified", () => {
    expect(
      capabilityType(entity("sensor.appliance", "enum"), {
        entityId: "sensor.appliance",
        matterDeviceType: "laundry_washer",
      }),
    ).toBe("laundry_washer");
    expect(
      capabilityType(entity("sensor.laundry_washer", "enum")),
    ).toBeUndefined();
    expect(capabilityType(entity("custom_plugin.room", ""))).toBeUndefined();
  });
  it("collects missing, failed, unavailable and conflicting mappings without checking unrelated inventory", () => {
    const issues = deviceIssues(
      [
        entity("sensor.temp", "temperature", "unavailable"),
        entity("sensor.unshared", "unknown", "unavailable"),
      ],
      [
        { entityId: "sensor.temp", humidityEntity: "sensor.missing" },
        { entityId: "fan.room", humidityEntity: "sensor.missing" },
      ],
      ["sensor.temp"],
      [{ entityId: "fan.room", reason: "Error" }],
      "alexa",
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "sensor.temp",
          kind: "unavailable",
        }),
        expect.objectContaining({
          entityId: "sensor.missing",
          kind: "missing",
        }),
        expect.objectContaining({
          entityId: "sensor.missing",
          kind: "conflict",
        }),
        expect.objectContaining({ entityId: "fan.room", kind: "failed" }),
      ]),
    );
    expect(issues.some((issue) => issue.entityId === "sensor.unshared")).toBe(
      false,
    );
  });
  it("reviews shape changes even when membership is unchanged", () => {
    const before = {
      entityId: "switch.plug",
      matterDeviceType: "on_off_plugin_unit" as const,
    };
    expect(
      mappingChanges(before, {
        ...before,
        matterDeviceType: "dimmable_plugin_unit",
      }),
    ).toEqual([
      {
        key: "matterDeviceType",
        before: '"on_off_plugin_unit"',
        after: '"dimmable_plugin_unit"',
      },
    ]);
    expect(selectionChanges(["a", "b"], ["b", "c"])).toEqual({
      added: ["c"],
      removed: ["a"],
    });
  });
});
