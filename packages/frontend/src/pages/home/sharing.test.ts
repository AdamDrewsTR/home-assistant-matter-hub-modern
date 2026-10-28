import { HomeAssistantMatcherType as Matcher } from "@home-assistant-matter-hub/common";
import { describe, expect, it } from "vitest";
import {
  editableLocation,
  emptyLocationSharing,
  locationFilter,
  selectedEntities,
  selectionFilter,
} from "./sharing.ts";

describe("simple sharing filters", () => {
  it("never flattens location rules into a fixed entity selection or drops additional advanced rules", () => {
    const filter = locationFilter({
      ...emptyLocationSharing,
      floorIds: ["upstairs"],
    });
    expect(selectedEntities(filter)).toBeNull();
    expect(editableLocation(filter)?.floorIds).toEqual(["upstairs"]);
    expect(
      editableLocation({
        ...filter,
        exclude: [{ type: Matcher.Pattern, value: "light.private" }],
      }),
    ).toBeUndefined();
  });
  it("round-trips an explicit device selection without widening access", () => {
    const filter = selectionFilter(["switch.fan", "light.desk", "light.desk"]);
    expect(selectedEntities(filter)).toEqual(["light.desk", "switch.fan"]);
    expect(filter.exclude).toEqual([]);
  });

  it("removing everything never produces the backend's include-everything filter", () => {
    const filter = selectionFilter([]);
    expect(filter.include).not.toHaveLength(0);
    const regex = new RegExp(filter.include[0].value);
    expect(regex.test("light.desk")).toBe(false);
    expect(selectedEntities(filter)).toEqual([]);
  });

  it.each([
    { include: [], exclude: [] },
    { include: [{ type: Matcher.Pattern, value: "light.*" }], exclude: [] },
    { include: [{ type: Matcher.Area, value: "kitchen" }], exclude: [] },
    {
      include: [{ type: Matcher.Pattern, value: "light.desk" }],
      exclude: [{ type: Matcher.Domain, value: "sensor" }],
    },
    {
      include: [{ type: Matcher.Pattern, value: "light.desk" }],
      exclude: [],
      includeMode: "all" as const,
    },
  ])("does not reinterpret advanced rules as a simple selection: %j", (filter) => {
    expect(selectedEntities(filter)).toBeNull();
  });
});
