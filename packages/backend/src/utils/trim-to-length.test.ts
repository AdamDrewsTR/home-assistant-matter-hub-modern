import { describe, expect, it } from "vitest";
import { trimToLength } from "./trim-to-length.js";

const bytes = (s?: string) => Buffer.byteLength(s ?? "");

describe("trimToLength", () => {
  it("cuts ASCII as before", () => {
    expect(trimToLength("Wohnzimmer Deckenlampe links hinten", 32, "...")).toBe(
      "Wohnzimmer Deckenlampe links ...",
    );
    expect(trimToLength("Kitchen", 32, "...")).toBe("Kitchen");
    expect(trimToLength("  ", 32, "...")).toBeUndefined();
  });

  it("keeps CJK names within the byte limit (#518)", () => {
    const name = "客厅空调伴侣 插座 电量 统计 传感器 小米";
    const trimmed = trimToLength(name, 32, "...");
    expect(bytes(trimmed)).toBeLessThanOrEqual(32);
    expect(trimmed).toBe("客厅空调伴侣 插座 电...");
    expect(trimToLength("客厅吸顶灯", 32, "...")).toBe("客厅吸顶灯");
  });

  it("never splits a surrogate pair", () => {
    const trimmed = trimToLength("💡".repeat(20), 64, "...");
    expect(bytes(trimmed)).toBeLessThanOrEqual(64);
    expect(trimmed).toBe(`${"💡".repeat(15)}...`);
  });
});
