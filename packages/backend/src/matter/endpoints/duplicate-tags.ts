import type { Endpoint } from "@matter/main";
import { DescriptorServer } from "@matter/main/behaviors";
import { DeviceClassification, Matter } from "@matter/main/model";
import { Namespace, type Semtag } from "@matter/main/types";

// Siblings that share an application device type need a Descriptor TagList
// (Base device type, Duplicate condition). Below an Aggregator the BridgedNode
// NodeLabel covers it, so this is for composed parts (#408) and server mode
// devices (#301), which sit under a plain parent.

const APPLICATION: ReadonlySet<string | undefined> = new Set([
  DeviceClassification.Application,
  DeviceClassification.Simple,
  DeviceClassification.Dynamic,
]);

// An explicit deviceTypeList default replaces the type's own device type, the
// same way DescriptorServer fills the attribute.
function applicationDeviceTypes(endpoint: Endpoint): number[] {
  const listed = endpoint.behaviors.supported.descriptor?.defaults
    .deviceTypeList as { deviceType: number }[] | undefined;
  const ids = listed?.length
    ? listed.map((d) => d.deviceType)
    : [endpoint.type.deviceType];
  return ids.filter((id) =>
    APPLICATION.has(Matter.deviceTypes(id)?.classification),
  );
}

/**
 * Common Number tag (One, Two, ...) for every sibling that shares an
 * application device type with another, counted per device type in the order
 * given, so a change to the lights never renumbers the locks. Siblings without
 * a duplicate get none.
 */
export function duplicateNumberTags(
  siblings: Endpoint[],
): Map<Endpoint, number> {
  const types = siblings.map((e) => [e, applicationDeviceTypes(e)] as const);
  const count = new Map<number, number>();
  for (const [, ids] of types) {
    for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  }
  const tags = new Map<Endpoint, number>();
  const next = new Map<number, number>();
  for (const [endpoint, ids] of types) {
    const dups = ids.filter((id) => (count.get(id) ?? 0) > 1);
    if (!dups.length) continue;
    // a part in two duplicated types (temp + humidity) takes a number that is
    // free in both
    const tag = Math.max(...dups.map((id) => next.get(id) ?? 1));
    // the namespace ends at Thirty, later duplicates stay untagged
    if (tag > 30) continue;
    tags.set(endpoint, tag);
    for (const id of dups) next.set(id, tag + 1);
  }
  return tags;
}

/**
 * Give an endpoint that is not installed yet a TagList with one Common Number
 * tag. TagList is fixed, the feature cannot be added to a live endpoint.
 */
export function setNumberTag(endpoint: Endpoint, tag: number) {
  const base =
    (endpoint.behaviors.supported.descriptor as
      | typeof DescriptorServer
      | undefined) ?? DescriptorServer;
  // Keep tags the type already carries, e.g. the Grid tag of a solar endpoint.
  const kept = (base.defaults as { tagList?: Semtag[] }).tagList ?? [];
  endpoint.behaviors.inject(
    base.with("TagList").set({
      tagList: [
        ...kept,
        { mfgCode: null, namespaceId: Namespace.CommonNumber, tag },
      ],
    }),
    undefined,
    false,
  );
}
