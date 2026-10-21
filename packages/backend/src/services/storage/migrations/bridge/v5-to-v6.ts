import type { StorageContext } from "@matter/main";

export async function migrateBridgeV5ToV6(
  storage: StorageContext,
): Promise<number> {
  const bridgeIds = await storage.get<string[]>("ids", []);

  for (const bridgeId of bridgeIds) {
    const bridgeValue = await storage.get<{} | undefined>(bridgeId);
    if (bridgeValue === undefined) {
      continue;
    }

    const bridge = bridgeValue as Record<string, unknown>;
    const featureFlags = bridge.featureFlags as Record<string, unknown>;
    if (featureFlags && "omitEventsInPriming" in featureFlags) {
      delete featureFlags.omitEventsInPriming;
      await storage.set(bridgeId, bridgeValue);
    }
  }
  return 6;
}
