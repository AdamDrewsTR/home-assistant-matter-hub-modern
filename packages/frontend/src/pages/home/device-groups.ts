import type { HomeEntity } from "../../api/home-inventory.ts";

export interface HomeDeviceGroup {
  id: string;
  name: string;
  areaId?: string;
  manufacturer?: string;
  model?: string;
  entities: HomeEntity[];
}

export function groupHomeDevices(entities: HomeEntity[]): HomeDeviceGroup[] {
  const devices = new Map<string, HomeDeviceGroup>();
  const sorted = [...entities].sort((a, b) =>
    a.entity_id.localeCompare(b.entity_id),
  );
  for (const entity of sorted) {
    // Keep a physical device together even when one entity overrides its area.
    const id = entity.device_id
      ? `device:${entity.device_id}`
      : `entity:${entity.entity_id}`;
    const group = devices.get(id) ?? {
      id,
      name: entity.device_name || entity.friendly_name || entity.entity_id,
      areaId: entity.device_area_id,
      manufacturer: entity.manufacturer,
      model: entity.model,
      entities: [],
    };
    group.entities.push(entity);
    devices.set(id, group);
  }
  for (const group of devices.values()) {
    group.areaId ??= group.entities.find((entity) => entity.area_id)?.area_id;
    group.entities.sort(
      (a, b) =>
        Number(a.domain === "sensor" || a.domain === "binary_sensor") -
          Number(b.domain === "sensor" || b.domain === "binary_sensor") ||
        (a.friendly_name || a.entity_id).localeCompare(
          b.friendly_name || b.entity_id,
        ),
    );
  }
  return [...devices.values()].sort((a, b) => a.name.localeCompare(b.name));
}
