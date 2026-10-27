import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHomeEntities } from "./home-inventory.ts";

afterEach(() => vi.unstubAllGlobals());

describe("home inventory", () => {
  it("loads every page instead of silently stopping at the API's 500-entity limit", async () => {
    const first = Array.from({ length: 500 }, (_, index) => ({
      entity_id: `light.item_${index}`,
    }));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 501, entities: first })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 501,
            entities: [{ entity_id: "light.last" }],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const entities = await fetchHomeEntities();
    expect(entities).toHaveLength(501);
    expect(fetch.mock.calls[1][0]).toContain("offset=500");
  });

  it("surfaces API errors instead of presenting an empty home", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: "Home Assistant disconnected" }),
            { status: 503 },
          ),
        ),
    );
    await expect(fetchHomeEntities()).rejects.toThrow(
      "Home Assistant disconnected",
    );
  });
});
