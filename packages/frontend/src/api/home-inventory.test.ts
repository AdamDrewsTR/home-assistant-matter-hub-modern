import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHomeEntities, fetchSharingSelection } from "./home-inventory.ts";

afterEach(() => vi.unstubAllGlobals());

describe("home inventory", () => {
  it("resolves every rule-matched entity, not just the first 100 preview rows", async () => {
    const ids = Array.from(
      { length: 130 },
      (_, index) => `sensor.item_${index}`,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            total: 130,
            truncated: true,
            entities: ids.slice(0, 100),
            entityIds: ids,
          }),
        ),
      ),
    );
    expect(await fetchSharingSelection({ include: [], exclude: [] })).toEqual(
      ids,
    );
  });
  it("refuses conversion against an older server or incomplete preview", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          async () =>
            new Response(
              JSON.stringify({ total: 130, truncated: true, entities: [] }),
            ),
        ),
    );
    await expect(
      fetchSharingSelection({ include: [], exclude: [] }),
    ).rejects.toThrow("complete sharing selection");
  });
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
