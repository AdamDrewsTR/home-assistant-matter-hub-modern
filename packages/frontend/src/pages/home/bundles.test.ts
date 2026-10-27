import { describe, expect, it } from "vitest";
import type { HomeEntity } from "../../api/home-inventory.ts";
import { suggestBundles, validateBundle } from "./bundles.ts";

export function sensor(
  deviceClass: string,
  unit: string,
  device = "monitor",
): HomeEntity {
  return {
    entity_id: `sensor.${deviceClass}`,
    domain: "sensor",
    device_id: device,
    state: "20",
    attributes: { device_class: deviceClass, unit_of_measurement: unit },
  };
}
const room = [
  sensor("temperature", "°C"),
  sensor("humidity", "%"),
  sensor("pressure", "hPa"),
  sensor("battery", "%"),
];

describe("reviewable device bundles", () => {
  it("uses physical device membership, sensor classes and units, not names", () => {
    const [bundle] = suggestBundles(
      [
        ...room,
        {
          ...sensor("humidity", "%", "other"),
          entity_id: "sensor.other_humidity",
        },
      ],
      [],
    );
    expect(bundle.kind).toBe("room");
    expect(bundle.mapping).toMatchObject({
      entityId: "sensor.temperature",
      composeDevice: true,
      batteryEntity: "sensor.battery",
      composedEntities: [
        { entityId: "sensor.humidity", matterDeviceType: "humidity_sensor" },
        { entityId: "sensor.pressure", matterDeviceType: "pressure_sensor" },
      ],
    });
    expect(bundle.members).not.toContain("sensor.other_humidity");
    expect(
      suggestBundles(
        room.map((entity) => ({
          ...entity,
          attributes: undefined,
          friendly_name: "Temperature humidity pressure battery",
        })),
        [],
      ),
    ).toEqual([]);
  });
  it("does not choose ambiguous, hidden, disabled, or wrongly measured sensors", () => {
    expect(suggestBundles([room[0], { ...room[1], hidden: true }], [])).toEqual(
      [],
    );
    expect(
      suggestBundles([room[0], { ...room[1], disabled: true }], []),
    ).toEqual([]);
    expect(suggestBundles([room[0], sensor("humidity", "W")], [])).toEqual([]);
    expect(
      suggestBundles(
        [room[0], room[1], { ...room[1], entity_id: "sensor.humidity_second" }],
        [],
      ),
    ).toEqual([]);
  });
  it("preserves existing mappings and refuses overlapping or cyclic ownership", () => {
    expect(
      suggestBundles(room, [
        { entityId: "sensor.temperature", customName: "Keep me" },
      ]),
    ).toEqual([]);
    const [bundle] = suggestBundles(room, []);
    expect(
      validateBundle(bundle, room, [
        {
          entityId: "light.other",
          composedEntities: [{ entityId: "sensor.humidity" }],
        },
      ]),
    ).toBe("conflict");
    expect(
      validateBundle(
        { ...bundle, members: [...bundle.members, bundle.primary] },
        room,
        [],
      ),
    ).toBe("members");
  });
  it("suggests motion and purifier compositions, and smart plug companions", () => {
    const motion: HomeEntity = {
      entity_id: "binary_sensor.motion",
      domain: "binary_sensor",
      device_id: "monitor",
      state: "on",
      attributes: { device_class: "motion" },
    };
    expect(
      suggestBundles([motion, sensor("illuminance", "lx"), room[0]], [])[0],
    ).toMatchObject({ kind: "motion", primary: motion.entity_id });
    const fan: HomeEntity = {
      ...motion,
      entity_id: "fan.purifier",
      domain: "fan",
      attributes: {},
    };
    expect(suggestBundles([fan, ...room], [])[0]).toMatchObject({
      kind: "purifier",
      mapping: { matterDeviceType: "air_purifier", composeDevice: true },
    });
    const plug: HomeEntity = {
      ...fan,
      entity_id: "switch.plug",
      domain: "switch",
    };
    expect(
      suggestBundles(
        [plug, sensor("power", "W"), sensor("energy", "kWh")],
        [],
      )[0],
    ).toMatchObject({
      kind: "plug",
      mapping: { powerEntity: "sensor.power", energyEntity: "sensor.energy" },
    });
  });
});
