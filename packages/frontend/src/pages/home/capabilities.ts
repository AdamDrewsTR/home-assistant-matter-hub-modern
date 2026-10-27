import {
  type EntityMappingConfig,
  type MatterDeviceType,
  matterDeviceTypeControllerSupport,
} from "@home-assistant-matter-hub/common";
import type { HomeEntity } from "../../api/home-inventory.ts";
import { mappedEntities } from "./bundles.ts";

// Advisory inventory hints, not a second endpoint factory. Diagnostics remain authoritative.
const sensorTypes: Record<string, MatterDeviceType> = {
  temperature: "temperature_sensor",
  humidity: "humidity_sensor",
  moisture: "humidity_sensor",
  pressure: "pressure_sensor",
  atmospheric_pressure: "pressure_sensor",
  illuminance: "light_sensor",
  volume_flow_rate: "flow_sensor",
  aqi: "air_quality_sensor",
  carbon_dioxide: "carbon_dioxide_sensor",
  carbon_monoxide: "carbon_monoxide_sensor",
  pm1: "pm1_sensor",
  pm25: "pm25_sensor",
  pm10: "pm10_sensor",
  volatile_organic_compounds: "tvoc_sensor",
  volatile_organic_compounds_parts: "tvoc_sensor",
  nitrogen_dioxide: "nitrogen_dioxide_sensor",
  ozone: "ozone_sensor",
  radon: "radon_sensor",
  power: "electrical_meter",
  energy: "electrical_meter",
  voltage: "electrical_meter",
  current: "electrical_meter",
};
const domainTypes: Record<string, MatterDeviceType> = {
  switch: "on_off_plugin_unit",
  input_boolean: "on_off_plugin_unit",
  lock: "door_lock",
  fan: "fan",
  climate: "thermostat",
  cover: "window_covering",
  vacuum: "robot_vacuum_cleaner",
  humidifier: "humidifier_dehumidifier",
  valve: "water_valve",
  water_heater: "water_heater",
  lawn_mower: "robotic_lawn_mower",
  button: "generic_switch",
  event: "generic_switch",
  input_button: "on_off_switch",
  scene: "on_off_switch",
  script: "on_off_switch",
  automation: "on_off_switch",
  select: "mode_select",
  input_select: "mode_select",
  siren: "on_off_plugin_unit",
};
export function capabilityType(
  entity: HomeEntity,
  mapping?: EntityMappingConfig,
): MatterDeviceType | undefined {
  if (mapping?.matterDeviceType) return mapping.matterDeviceType;
  const deviceClass = String(entity.attributes?.device_class ?? "");
  if (entity.domain === "sensor") return sensorTypes[deviceClass];
  if (entity.domain === "binary_sensor") {
    if (["smoke", "carbon_monoxide", "gas"].includes(deviceClass))
      return "smoke_co_alarm";
    if (["motion", "moving"].includes(deviceClass)) return "motion_sensor";
    if (["occupancy", "presence"].includes(deviceClass))
      return "occupancy_sensor";
    if (
      ["battery_charging", "light", "plug", "power", "running"].includes(
        deviceClass,
      ) ||
      !deviceClass
    )
      return undefined;
    return "contact_sensor";
  }
  if (entity.domain === "light") {
    const modes = entity.attributes?.supported_color_modes;
    if (!Array.isArray(modes)) return undefined;
    if (
      modes.some((mode) => ["xy", "hs", "rgb", "rgbw", "rgbww"].includes(mode))
    )
      return "extended_color_light";
    if (modes.includes("color_temp")) return "color_temperature_light";
    if (modes.includes("brightness")) return "dimmable_light";
    return "on_off_light";
  }
  return domainTypes[entity.domain];
}

export interface DeviceIssue {
  entityId: string;
  kind:
    | "unavailable"
    | "failed"
    | "unclassified"
    | "conflict"
    | "missing"
    | "controller";
  detail?: string;
}
export function deviceIssues(
  entities: HomeEntity[],
  mappings: EntityMappingConfig[],
  shared: string[] | null,
  failures: { entityId: string; reason: string }[],
  controller: "apple" | "google" | "alexa" | "aqara" | "smartthings",
): DeviceIssue[] {
  const relevant = new Set([
    ...(shared ?? []),
    ...mappings.flatMap(mappedEntities),
  ]);
  const issues: DeviceIssue[] = failures.map((failure) => ({
    entityId: failure.entityId,
    kind: "failed",
    detail: failure.reason,
  }));
  const byId = new Map(entities.map((entity) => [entity.entity_id, entity]));
  for (const id of relevant) {
    const entity = byId.get(id);
    if (!entity) {
      issues.push({ entityId: id, kind: "missing" });
      continue;
    }
    if (["unknown", "unavailable"].includes(entity.state))
      issues.push({ entityId: id, kind: "unavailable" });
    const type = capabilityType(
      entity,
      mappings.find((mapping) => mapping.entityId === id),
    );
    if (!type) issues.push({ entityId: id, kind: "unclassified" });
    else if (matterDeviceTypeControllerSupport[type]?.[controller] !== "yes")
      issues.push({ entityId: id, kind: "controller", detail: type });
  }
  const owners = new Map<string, Set<string>>();
  for (const mapping of mappings) {
    const refs = mappedEntities(mapping);
    for (const id of refs) {
      const current = owners.get(id) ?? new Set<string>();
      current.add(mapping.entityId);
      owners.set(id, current);
      if (
        !byId.has(id) &&
        !issues.some(
          (issue) => issue.entityId === id && issue.kind === "missing",
        )
      )
        issues.push({ entityId: id, kind: "missing" });
    }
  }
  for (const [id, current] of owners)
    if (current.size > 1)
      issues.push({
        entityId: id,
        kind: "conflict",
        detail: [...current].join(", "),
      });
  return issues;
}
