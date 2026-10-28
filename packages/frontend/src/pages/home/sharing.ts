import {
  type HomeAssistantFilter,
  HomeAssistantMatcherType,
  type LocationSharing,
} from "@home-assistant-matter-hub/common";

export const emptyLocationSharing: LocationSharing = {
  areaIds: [],
  floorIds: [],
  excludedDeviceIds: [],
  excludedEntityIds: [],
};

export function locationFilter(location: LocationSharing): HomeAssistantFilter {
  return { include: [], exclude: [], location };
}

export function editableLocation(
  filter: HomeAssistantFilter,
): LocationSharing | undefined {
  return filter.location && !filter.include.length && !filter.exclude.length
    ? filter.location
    : undefined;
}

// An empty include array means "everything" to the bridge, not "nothing".
export const emptySelectionFilter: HomeAssistantFilter = {
  include: [{ type: HomeAssistantMatcherType.Regex, value: "^$" }],
  exclude: [],
};

export function selectionFilter(ids: readonly string[]): HomeAssistantFilter {
  if (!ids.length) return emptySelectionFilter;
  return {
    include: [...new Set(ids)].sort().map((value) => ({
      type: HomeAssistantMatcherType.Pattern,
      value,
    })),
    exclude: [],
  };
}

export function selectedEntities(filter: HomeAssistantFilter): string[] | null {
  if (filter.location) return null;
  if (filter.exclude.length || filter.includeMode === "all") return null;
  if (
    filter.include.length === 1 &&
    filter.include[0].type === HomeAssistantMatcherType.Regex &&
    filter.include[0].value === "^$"
  ) {
    return [];
  }
  if (
    !filter.include.length ||
    !filter.include.every(
      (rule) =>
        rule.type === HomeAssistantMatcherType.Pattern &&
        /^[a-z_]+\.[a-z0-9_]+$/.test(rule.value),
    )
  ) {
    return null;
  }
  return filter.include.map((rule) => rule.value);
}
