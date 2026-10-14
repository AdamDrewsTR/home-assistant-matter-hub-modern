import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EntityMappingConfig,
  HomeAssistantEntityInformation,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { Endpoint, VendorId } from "@matter/main";
import { DeviceTypeConformanceService, ServerNode } from "@matter/main/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeDataProvider } from "../../../../../services/bridges/bridge-data-provider.js";
import { EntityStateProvider } from "../../../../../services/bridges/entity-state-provider.js";
import { HomeAssistantActions } from "../../../../../services/home-assistant/home-assistant-actions.js";
import { HomeAssistantConfig } from "../../../../../services/home-assistant/home-assistant-config.js";
import { AggregatorEndpoint } from "../../../aggregator-endpoint.js";
import { updateEntityState } from "../../../update-entity-state.js";
import { createLegacyEndpointType } from "../../create-legacy-endpoint-type.js";

// #419: an EnergyEvse (0x050C) whose mandatory EnergyEvse + EnergyEvseMode
// clusters are not seeded throws AggregateError on mount. This brings the real
// endpoint online through createLegacyEndpointType and checks the seeded wire
// values plus the command list that only appears once the handlers exist.

const ENERGY_EVSE = 0x050c; // 1292
const ELECTRICAL_SENSOR = 0x0510; // 1296
const POWER_SOURCE = 0x0011; // 17
const BRIDGED_NODE = 0x0013; // 19
const DEVICE_ENERGY_MANAGEMENT = 0x050d; // 1293

let dir: string;
let env: Environment;
let counter = 0;
let server: ServerNode | undefined;
let mounted: Endpoint | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hamh-evse-"));
  env = new Environment("test", Environment.default);
  env.get(VariableService).set("storage.path", dir);
  env.set(HomeAssistantActions, {
    call() {},
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
  env.set(
    BridgeDataProvider,
    new BridgeDataProvider({
      id: "b",
      name: "b",
      port: 0,
      filter: { include: [], exclude: [], includeMode: "any" },
      basicInformation: {
        vendorId: 0xfff1,
        vendorName: "t",
        productName: "t",
        productLabel: "t",
        hardwareVersion: 1,
        softwareVersion: 1,
        // biome-ignore lint/suspicious/noExplicitAny: test fixture
      } as any,
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any),
  );
  env.set(HomeAssistantConfig, {
    unitSystem: { temperature: "°C" },
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
  env.set(EntityStateProvider, {
    getState: () => undefined,
    getNumericState: () => null,
    getBatteryPercent: () => null,
    // biome-ignore lint/suspicious/noExplicitAny: test stub
  } as any);
});

afterEach(async () => {
  await server?.close().catch(() => {});
  server = undefined;
  rmSync(dir, { recursive: true, force: true });
});

function statusEntity(
  entityId: string,
  value: string,
): HomeAssistantEntityInformation {
  const state = {
    entity_id: entityId,
    state: value,
    attributes: { friendly_name: entityId },
    context: { id: "c" },
    last_changed: "2026-01-01T00:00:00",
    last_updated: "2026-01-01T00:00:00",
  };
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  return { entity_id: entityId, state: state as any };
}

interface Snapshot {
  deviceTypes: number[];
  supplyState: number;
  faultState: number;
  state: number | null;
  currentMode: number;
  supportedModes: number;
  acceptedCommands: number[];
  powerSourceStatus: number | null;
  hasPowerMeasurement: boolean;
  hasEnergyMeasurement: boolean;
  hasPowerTopology: boolean;
  treeTopology: boolean;
  nodeTopology: boolean;
  setTopology: boolean;
  dynamicPowerFlow: boolean;
  violations: string[];
  // biome-ignore lint/suspicious/noExplicitAny: raw cluster state
  dem: any;
}

async function bringUp(
  entity: HomeAssistantEntityInformation,
  mapping?: EntityMappingConfig,
): Promise<Snapshot> {
  const type = createLegacyEndpointType(entity, {
    entityId: entity.entity_id,
    matterDeviceType: "evse",
    ...mapping,
  });
  if (!type) {
    throw new Error("no endpoint type");
  }
  server = await ServerNode.create({
    // biome-ignore lint/suspicious/noExplicitAny: env valid at runtime
    environment: env as any,
    id: `evse-node-${counter++}`,
    network: { port: 0 },
    commissioning: { passcode: 20202021, discriminator: 3840 },
    basicInformation: { vendorId: VendorId(0xfff1), productId: 0x8000 },
  });
  const aggregator = new AggregatorEndpoint("aggregator");
  await server.add(aggregator);
  const endpoint = new Endpoint(type, { id: "evse" });
  await aggregator.add(endpoint);
  mounted = endpoint;

  const snapshot: Snapshot = {
    deviceTypes: [],
    supplyState: Number.NaN,
    faultState: Number.NaN,
    state: null,
    currentMode: Number.NaN,
    supportedModes: 0,
    acceptedCommands: [],
    powerSourceStatus: null,
    hasPowerMeasurement: false,
    hasEnergyMeasurement: false,
    hasPowerTopology: false,
    treeTopology: false,
    nodeTopology: false,
    setTopology: false,
    dynamicPowerFlow: false,
    violations: [],
    dem: undefined,
  };
  await endpoint.act((agent) => {
    // biome-ignore lint/suspicious/noExplicitAny: read cluster state
    const a = agent as any;
    const dtl = a.descriptor.state.deviceTypeList as Array<{
      deviceType: number;
    }>;
    snapshot.deviceTypes = dtl.map((d) => Number(d.deviceType));
    snapshot.supplyState = Number(a.energyEvse.state.supplyState);
    snapshot.faultState = Number(a.energyEvse.state.faultState);
    snapshot.state =
      a.energyEvse.state.state == null
        ? null
        : Number(a.energyEvse.state.state);
    snapshot.acceptedCommands = (
      a.energyEvse.state.acceptedCommandList as number[]
    ).map((c) => Number(c));
    snapshot.currentMode = Number(a.energyEvseMode.state.currentMode);
    snapshot.supportedModes = a.energyEvseMode.state.supportedModes.length;
    snapshot.powerSourceStatus =
      a.powerSource?.state.status == null
        ? null
        : Number(a.powerSource.state.status);
    snapshot.hasPowerMeasurement =
      a.electricalPowerMeasurement?.state.activePower != null;
    snapshot.hasEnergyMeasurement =
      a.electricalEnergyMeasurement?.state.cumulativeEnergyImported != null;
    const topology = a.powerTopology?.state.featureMap;
    snapshot.hasPowerTopology = topology != null;
    snapshot.treeTopology = topology?.treeTopology === true;
    snapshot.nodeTopology = topology?.nodeTopology === true;
    snapshot.setTopology = topology?.setTopology === true;
    snapshot.dynamicPowerFlow = topology?.dynamicPowerFlow === true;
    const dem = a.deviceEnergyManagement?.state;
    snapshot.dem = dem && {
      featureMap: dem.featureMap,
      esaType: dem.esaType,
      esaCanGenerate: dem.esaCanGenerate,
      esaState: dem.esaState,
      absMinPower: dem.absMinPower,
      absMaxPower: dem.absMaxPower,
      forecast: dem.forecast,
    };
  });
  const verdict = server.env
    .get(DeviceTypeConformanceService)
    .validateNodeScope(endpoint, { refuse: false });
  snapshot.violations = (verdict.get(endpoint) ?? []).map(
    (v) => `${v.kind} ${v.deviceType} ${v.requirement}`,
  );
  return snapshot;
}

describe("energy evse bring-up (#419 seeding)", () => {
  it("mounts a status sensor as EnergyEvse without AggregateError", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );

    expect(snapshot.deviceTypes).toContain(ENERGY_EVSE);
    // supplyState / faultState seeded so the endpoint doesn't brick on mount.
    expect(snapshot.supplyState).toBe(0); // Disabled
    expect(snapshot.faultState).toBe(0); // NoError
  });

  it("seeds Manual as mode 0 and selects it (#475)", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );
    expect(snapshot.supportedModes).toBe(2);
    expect(snapshot.currentMode).toBe(0);
  });

  it("advertises Disable (1) and EnableCharging (2) once handlers exist", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );
    expect(snapshot.acceptedCommands).toContain(1);
    expect(snapshot.acceptedCommands).toContain(2);
  });

  it("maps a charging status to PluggedInCharging + ChargingEnabled", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "charging"),
    );
    expect(snapshot.state).toBe(3); // PluggedInCharging
    expect(snapshot.supplyState).toBe(1); // ChargingEnabled
  });

  it("composes the EnergyEvse + ElectricalSensor device types with a seeded power source", async () => {
    // No mapping at all: the mandatory composition must still stand up.
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );

    // Exact: the descriptor is what a controller reads, so an extra or missing
    // device type must not slip through unnoticed.
    expect(snapshot.deviceTypes).toEqual([
      ENERGY_EVSE,
      ELECTRICAL_SENSOR,
      DEVICE_ENERGY_MANAGEMENT,
      POWER_SOURCE,
      BRIDGED_NODE,
    ]);

    // Wired PowerSource seeded Active so the mandatory attrs don't brick.
    expect(snapshot.powerSourceStatus).toBe(1); // Active

    // Measurement clusters are mounted unconditionally with safe defaults.
    expect(snapshot.hasPowerMeasurement).toBe(true);
    expect(snapshot.hasEnergyMeasurement).toBe(true);
  });

  // The ElectricalSensor device type mandates PowerTopology, and tree scope
  // keeps the wallbox reading on this endpoint instead of the bridge (#431).
  it("carries PowerTopology scoped to the endpoint", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );

    expect(snapshot.hasPowerTopology).toBe(true);
    expect(snapshot.treeTopology).toBe(false);
    expect(snapshot.nodeTopology).toBe(false);
    // NODE/TREE/SET are a choice, and DYNPW pulls in attributes nothing seeds,
    // so the whole map is pinned instead of just the set bit.
    expect(snapshot.setTopology).toBe(true);
    expect(snapshot.dynamicPowerFlow).toBe(false);
  });

  // EnergyEvse requires a DeviceEnergyManagement component with PFR. Nothing
  // adjustable is claimed and the forecast stays null.
  it("carries DeviceEnergyManagement and meets its device types", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "idle"),
    );

    expect(snapshot.deviceTypes).toContain(DEVICE_ENERGY_MANAGEMENT);
    // The pinned 20261008 nightly counts components on child endpoints only,
    // so it still flags the ones listed on this endpoint itself.
    const ownComponents = [
      "PowerSource",
      "ElectricalSensor",
      "DeviceEnergyManagement",
    ].map((name) => `instanceCount EnergyEvse device:${name}`);
    expect(
      snapshot.violations.filter((v) => !ownComponents.includes(v)),
    ).toEqual([]);
    expect(snapshot.dem).toEqual({
      featureMap: {
        powerAdjustment: false,
        powerForecastReporting: true,
        stateForecastReporting: false,
        startTimeAdjustment: false,
        pausable: false,
        forecastAdjustment: false,
        constraintBasedAdjustment: false,
      },
      esaType: 0, // Evse
      esaCanGenerate: false,
      esaState: 1, // Online
      absMinPower: 1_380_000, // 6 A at 230 V, in mW
      absMaxPower: 7_360_000, // 32 A at 230 V
      forecast: null,
    });
  });

  it("reports the ESA offline while the status entity is unavailable", async () => {
    const snapshot = await bringUp(
      statusEntity("sensor.wallbox_status", "unavailable"),
    );
    expect(snapshot.dem.esaState).toBe(0); // Offline
  });

  it("follows the status entity into offline and back after mount", async () => {
    await bringUp(statusEntity("sensor.wallbox_status", "idle"));
    const endpoint = mounted as Endpoint;
    const esaState = () =>
      endpoint.act((agent) => {
        // biome-ignore lint/suspicious/noExplicitAny: read cluster state
        const a = agent as any;
        return Number(a.deviceEnergyManagement.state.esaState);
      });
    const seen = [await esaState()];
    for (const value of ["unavailable", "charging"]) {
      await updateEntityState(
        endpoint,
        statusEntity("sensor.wallbox_status", value).state,
      );
      seen.push(await esaState());
    }
    expect(seen).toEqual([1, 0, 1]);
  });
});
