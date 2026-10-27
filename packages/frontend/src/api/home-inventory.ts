import type { HomeAssistantFilter } from "@home-assistant-matter-hub/common";
import { assertOk, parseJsonResponse } from "./fetch-utils.ts";

export async function fetchSharingSelection(
  filter: HomeAssistantFilter,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch("api/matter/filter-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filter),
    signal,
  });
  await assertOk(response, "Could not resolve current sharing rules");
  const result = await parseJsonResponse<{
    total: number;
    entityIds?: string[];
  }>(response);
  if (
    !Array.isArray(result.entityIds) ||
    result.entityIds.length !== result.total ||
    !result.entityIds.every((id) => typeof id === "string")
  ) {
    throw new Error(
      "The server did not return a complete sharing selection. Update Matter Hub Modern before converting rules.",
    );
  }
  return result.entityIds;
}

export interface HomeEntity {
  entity_id: string;
  friendly_name?: string;
  domain: string;
  device_id?: string;
  device_name?: string;
  device_area_id?: string;
  manufacturer?: string;
  model?: string;
  area_id?: string;
  disabled?: boolean;
  hidden?: boolean;
  entity_category?: string;
  state: string;
  attributes?: Record<string, unknown>;
}

export async function fetchHomeEntities(signal?: AbortSignal) {
  const entities: HomeEntity[] = [];
  let total: number;
  do {
    const response = await fetch(
      `api/home-assistant/entities?limit=500&offset=${entities.length}`,
      { signal },
    );
    await assertOk(response, "Could not load Home Assistant devices");
    const page = await parseJsonResponse<{
      entities: HomeEntity[];
      total: number;
    }>(response);
    if (!page.entities.length && entities.length < page.total) {
      throw new Error("Device inventory changed while loading. Please retry.");
    }
    entities.push(...page.entities);
    total = page.total;
  } while (entities.length < total);
  return entities;
}
