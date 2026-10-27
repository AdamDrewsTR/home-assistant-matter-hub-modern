import { assertOk, parseJsonResponse } from "./fetch-utils.ts";

export interface HomeEntity {
  entity_id: string;
  friendly_name?: string;
  domain: string;
  device_id?: string;
  device_name?: string;
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
