import type {
  EntityMappingConfig,
  MatterDeviceType,
} from "@home-assistant-matter-hub/common";
import { entityMappingReferences } from "@home-assistant-matter-hub/common";
import type { HomeEntity } from "../../api/home-inventory.ts";

export type BundleKind = "room" | "motion" | "purifier" | "plug" | "custom";
export interface DeviceBundle {
  kind: BundleKind;
  primary: string;
  members: string[];
  mapping: EntityMappingConfig;
}

export const mappedEntities = entityMappingReferences;

export function suggestBundles(
  entities: HomeEntity[],
  mappings: EntityMappingConfig[],
): DeviceBundle[] {
  const claimed = new Set(mappings.flatMap(mappedEntities));
  const devices = new Map<string, HomeEntity[]>();
  for (const entity of entities) {
    if (
      !entity.device_id ||
      entity.disabled ||
      entity.hidden ||
      claimed.has(entity.entity_id)
    )
      continue;
    if (entity.entity_category && entity.attributes?.device_class !== "battery")
      continue;
    const device = devices.get(entity.device_id) ?? [];
    device.push(entity);
    devices.set(entity.device_id, device);
  }
  const suggestions: DeviceBundle[] = [];
  for (const device of devices.values()) {
    const unique = (domain: string, deviceClass?: string) => {
      const matches = device.filter(
        (entity) =>
          entity.domain === domain &&
          (!deviceClass || entity.attributes?.device_class === deviceClass) &&
          (domain !== "sensor" || validUnit(entity)),
      );
      return matches.length === 1 ? matches[0] : undefined;
    };
    const temp = unique("sensor", "temperature");
    const humidity = unique("sensor", "humidity");
    const pressure = unique("sensor", "pressure");
    const battery = unique("sensor", "battery");
    const motionCandidates = device.filter(
      (entity) =>
        entity.domain === "binary_sensor" &&
        ["occupancy", "motion"].includes(
          String(entity.attributes?.device_class),
        ),
    );
    const motion =
      motionCandidates.length === 1 ? motionCandidates[0] : undefined;
    const fan = unique("fan");
    const plug = unique("switch");
    const primary = fan ?? motion ?? temp;
    if (primary) {
      const parts: { entityId: string; matterDeviceType: MatterDeviceType }[] =
        [];
      if (temp && temp !== primary)
        parts.push({
          entityId: temp.entity_id,
          matterDeviceType: "temperature_sensor",
        });
      if (humidity)
        parts.push({
          entityId: humidity.entity_id,
          matterDeviceType: "humidity_sensor",
        });
      if (pressure && !fan)
        parts.push({
          entityId: pressure.entity_id,
          matterDeviceType: "pressure_sensor",
        });
      const lux = unique("sensor", "illuminance");
      if (motion && primary === motion && lux)
        parts.push({
          entityId: lux.entity_id,
          matterDeviceType: "light_sensor",
        });
      if (parts.length > 0) {
        suggestions.push({
          kind: fan ? "purifier" : motion ? "motion" : "room",
          primary: primary.entity_id,
          members: [
            primary.entity_id,
            ...parts.map((part) => part.entityId),
            ...(battery ? [battery.entity_id] : []),
          ],
          mapping: {
            entityId: primary.entity_id,
            composeDevice: true,
            composedEntities: parts,
            ...(fan && { matterDeviceType: "air_purifier" as const }),
            ...(battery && { batteryEntity: battery.entity_id }),
          },
        });
      }
    }
    if (plug) {
      const mapping: EntityMappingConfig = {
        entityId: plug.entity_id,
        powerEntity: unique("sensor", "power")?.entity_id,
        energyEntity: unique("sensor", "energy")?.entity_id,
        voltageEntity: unique("sensor", "voltage")?.entity_id,
        currentEntity: unique("sensor", "current")?.entity_id,
      };
      const members = mappedEntities(mapping);
      if (members.length > 1)
        suggestions.push({
          kind: "plug",
          primary: plug.entity_id,
          members,
          mapping,
        });
    }
  }
  return suggestions;
}

function validUnit(entity: HomeEntity): boolean {
  const units: Record<string, string[]> = {
    temperature: ["°C", "°F"],
    humidity: ["%"],
    battery: ["%"],
    pressure: ["Pa", "hPa", "kPa", "mbar", "bar", "psi", "inHg", "mmHg"],
    illuminance: ["lx"],
    power: ["W", "kW"],
    energy: ["Wh", "kWh"],
    voltage: ["V", "mV"],
    current: ["A", "mA"],
  };
  const deviceClass = entity.attributes?.device_class;
  const unit = entity.attributes?.unit_of_measurement;
  return (
    typeof deviceClass === "string" &&
    typeof unit === "string" &&
    (units[deviceClass]?.includes(unit) ?? false)
  );
}

export function validateBundle(
  bundle: DeviceBundle,
  entities: HomeEntity[],
  mappings: EntityMappingConfig[],
): string | undefined {
  if (
    new Set(bundle.members).size !== bundle.members.length ||
    bundle.members.length < 2
  )
    return "members";
  if (
    bundle.members.some(
      (id) =>
        !entities.some(
          (entity) =>
            entity.entity_id === id && !entity.disabled && !entity.hidden,
        ),
    )
  )
    return "missing";
  if (
    bundle.members.some((id) =>
      entities.some(
        (entity) =>
          entity.entity_id === id &&
          ["unknown", "unavailable"].includes(entity.state),
      ),
    )
  )
    return "unavailable";
  const claimed = new Set(mappings.flatMap(mappedEntities));
  if (bundle.members.some((id) => claimed.has(id))) return "conflict";
}
