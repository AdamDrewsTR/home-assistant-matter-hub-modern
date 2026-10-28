import type { HomeAssistantAreaRegistry } from "./home-assistant-area-registry.js";
import type { HomeAssistantDeviceRegistry } from "./home-assistant-device-registry.js";
import type { HomeAssistantEntityRegistry } from "./home-assistant-entity-registry.js";

export enum HomeAssistantMatcherType {
  Pattern = "pattern",
  Regex = "regex",
  Domain = "domain",
  Platform = "platform",
  /** @deprecated Use EntityLabel or DeviceLabel instead */
  Label = "label",
  EntityLabel = "entity_label",
  DeviceLabel = "device_label",
  EntityLabelRegex = "entity_label_regex",
  DeviceLabelRegex = "device_label_regex",
  AnyFieldRegex = "any_field_regex",
  Area = "area",
  EntityCategory = "entity_category",
  DeviceName = "device_name",
  ProductName = "product_name",
  Manufacturer = "manufacturer",
  DeviceClass = "device_class",
}

export interface HomeAssistantMatcher {
  readonly type: HomeAssistantMatcherType;
  readonly value: string;
}

export type HomeAssistantFilterMode = "any" | "all";

export interface HomeAssistantFilter {
  /** Dynamic location scope, applied before ordinary include/exclude rules. */
  location?: LocationSharing;
  include: HomeAssistantMatcher[];
  exclude: HomeAssistantMatcher[];
  /** How to combine include rules: "any" (OR) or "all" (AND). Default: "any" */
  includeMode?: HomeAssistantFilterMode;
}

export interface LocationSharing {
  areaIds: string[];
  floorIds: string[];
  excludedDeviceIds: string[];
  excludedEntityIds: string[];
  includeDiagnosticEntities?: boolean;
}

export interface HomeAssistantFloorRegistry {
  floor_id: string;
  name: string;
}

export function matchesLocationSharing(
  location: LocationSharing,
  entity: HomeAssistantEntityRegistry,
  device: HomeAssistantDeviceRegistry | undefined,
  areas: readonly HomeAssistantAreaRegistry[],
): boolean {
  if (entity.disabled_by != null || entity.hidden_by != null) return false;
  if (
    !location.includeDiagnosticEntities &&
    (entity.entity_category === "diagnostic" ||
      entity.entity_category === "config")
  )
    return false;
  if (
    location.excludedEntityIds.includes(entity.entity_id) ||
    (entity.device_id && location.excludedDeviceIds.includes(entity.device_id))
  )
    return false;
  // Follow the physical device's room, not a sensor's individual override.
  const areaId =
    typeof device?.area_id === "string" && device.area_id
      ? device.area_id
      : entity.area_id;
  const area = areas.find((item) => item.area_id === areaId);
  if (!area) return false;
  return (
    location.areaIds.includes(area.area_id) ||
    !!(area.floor_id && location.floorIds.includes(area.floor_id))
  );
}
