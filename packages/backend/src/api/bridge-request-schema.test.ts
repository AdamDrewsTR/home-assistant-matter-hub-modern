import { updateBridgeRequestSchema } from "@home-assistant-matter-hub/common";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

describe("bridge request schema", () => {
  // A bridge saved by an older version can still carry a removed flag,
  // like omitEventsInPriming. Saving it again must not be rejected.
  it("accepts unknown feature flags", () => {
    const valid = new Ajv().validate(updateBridgeRequestSchema, {
      id: "b1",
      name: "Bridge",
      port: 5540,
      filter: { include: [], exclude: [] },
      featureFlags: { omitEventsInPriming: true },
    });
    expect(valid).toBe(true);
  });
});
