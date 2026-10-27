import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type BridgeData,
  type EntityMappingConfig,
  HomeAssistantMatcherType,
} from "@home-assistant-matter-hub/common";
import { Environment, VariableService } from "@matter/general";
import { StorageService } from "@matter/main";
import archiver from "archiver";
import express from "express";
import unzipper from "unzipper";
import { afterAll, describe, expect, it } from "vitest";
import type { BackupService } from "../services/backup/backup-service.js";
import type { AppSettingsStorage } from "../services/storage/app-settings-storage.js";
import { AppStorage } from "../services/storage/app-storage.js";
import { BridgeStorage } from "../services/storage/bridge-storage.js";
import { EntityMappingStorage } from "../services/storage/entity-mapping-storage.js";
import { type BackupData, backupApi } from "./backup-api.js";

// #439 review: the manager's per-bridge plugin-state file lives at the storage
// root, outside the identity directory the backup archives, so it has to be
// carried explicitly or a clean restore forgets which plugins were disabled.

const dir = mkdtempSync(join(tmpdir(), "hamh-backup-api-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const bridgeStorage = {
  bridges: [{ id: "b1", name: "Bridge One", port: 5540 }],
  add: async () => {},
} as unknown as BridgeStorage;
const mappingStorage = {
  getMappingsForBridge: () => [],
  setMapping: async () => {},
} as unknown as EntityMappingStorage;

async function withRouter(
  fn: (base: string) => Promise<void>,
  settingsStorage = {} as unknown as AppSettingsStorage,
  stores = {
    bridges: bridgeStorage,
    mappings: mappingStorage,
    location: dir,
    backups: {} as BackupService,
  },
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(
    "/backup",
    backupApi(
      stores.bridges,
      stores.mappings,
      stores.location,
      stores.backups,
      settingsStorage,
    ),
  );
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function openStores(location: string) {
  const env = new Environment("backup-compatibility", Environment.default);
  env.get(VariableService).set("storage.path", location);
  const app = new AppStorage(env.get(StorageService));
  await app.construction;
  const bridges = new BridgeStorage(app);
  const mappings = new EntityMappingStorage(app);
  await Promise.all([bridges.construction, mappings.construction]);
  return {
    bridges,
    mappings,
    location,
    backups: {} as BackupService,
    close: async () => {
      await mappings.dispose();
      await app.dispose();
    },
  };
}

async function legacyArchive(
  metadata: BackupData,
  files: Record<string, Buffer> = {},
) {
  const archive = archiver("zip");
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
  archive.append(JSON.stringify(metadata), { name: "backup.json" });
  for (const [name, content] of Object.entries(files))
    archive.append(content, { name });
  await archive.finalize();
  return complete;
}

const legacyBridge: BridgeData = {
  id: "legacy-home",
  name: "Existing home",
  port: 5547,
  filter: {
    include: [{ type: HomeAssistantMatcherType.Label, value: "matter" }],
    exclude: [
      { type: HomeAssistantMatcherType.Pattern, value: "sensor.private_*" },
    ],
  },
  featureFlags: { stableIdentity: true, autoComposedDevices: true },
  basicInformation: {
    vendorId: 0xfff1,
    vendorName: "Existing vendor",
    productId: 0x8000,
    productName: "Existing hub",
    productLabel: "Existing home",
    hardwareVersion: 1,
    softwareVersion: 1,
  },
};
const legacyMapping: EntityMappingConfig = {
  entityId: "sensor.temperature",
  customName: "Existing monitor",
  customSerialNumber: "existing-device-serial",
  customProductName: "Existing product",
  customVendorName: "Existing device vendor",
  customVendorId: 0xfff1,
  updateThrottleMs: 750,
  temperatureEntity: "sensor.probe",
  humidityEntity: "sensor.humidity",
  faultEntity: "binary_sensor.fault",
  operationalStateEntity: "sensor.operation",
  currentRoomEntity: "sensor.current_room",
  cleanedAreaEntity: "sensor.cleaned_area",
  climateKeepModeOnIdle: true,
  climateForceTurnOn: true,
  climateExposeFan: true,
  fanRestoreSpeedOnPowerOn: true,
  composeDevice: true,
  composedEntities: [
    { entityId: "sensor.humidity", matterDeviceType: "humidity_sensor" },
  ],
};

describe("legacy backup compatibility", () => {
  it.each([
    "upload",
    "snapshot",
  ] as const)("preserves full mappings, rules and opaque identity files through %s restore and disk reload", async (method) => {
    const location = mkdtempSync(join(dir, `compat-${method}-`));
    const files = {
      "identity/legacy-home/fabrics/state.json": Buffer.from(
        '{"syntheticTestFabric":1,"nodeId":"1234"}',
      ),
      "identity/legacy-home/nested/identity.bin": Buffer.from([
        0, 255, 17, 128,
      ]),
      "plugin-state/legacy-home.json": Buffer.from('{"camera":false}'),
    };
    const archive = await legacyArchive(
      {
        version: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        bridges: [legacyBridge],
        entityMappings: { [legacyBridge.id]: [legacyMapping] },
        includesIdentity: true,
      },
      files,
    );
    const stores = await openStores(location);
    try {
      const snapshotPath = join(location, "legacy-backup.zip");
      writeFileSync(snapshotPath, archive);
      stores.backups = {
        getBackupPath: () => snapshotPath,
      } as unknown as BackupService;
      await withRouter(
        async (base) => {
          const form = new FormData();
          form.append(
            "file",
            new Blob([Uint8Array.from(archive)]),
            "legacy.zip",
          );
          const preview = await fetch(`${base}/backup/restore/preview`, {
            method: "POST",
            body: form,
          });
          expect(preview.status).toBe(200);
          expect(await preview.json()).toMatchObject({
            includesIdentity: true,
            bridges: [{ id: legacyBridge.id, exists: false, mappingCount: 1 }],
          });
          expect(stores.bridges.bridges).toEqual([]);
          expect(existsSync(join(location, legacyBridge.id))).toBe(false);
          const restore = await fetch(
            `${base}/backup/${method === "upload" ? "restore" : "snapshots/legacy-backup.zip/restore"}`,
            method === "upload"
              ? { method: "POST", body: form }
              : {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                },
          );
          expect(restore.status).toBe(200);
          expect(await restore.json()).toMatchObject({
            bridgesRestored: 1,
            mappingsRestored: 1,
            identitiesRestored: 1,
            errors: [],
            restartRequired: true,
          });
        },
        undefined,
        stores,
      );
    } finally {
      await stores.close();
    }
    const reloaded = await openStores(location);
    try {
      expect(reloaded.bridges.bridges).toEqual([legacyBridge]);
      const mapping = reloaded.mappings.getMapping(
        legacyBridge.id,
        legacyMapping.entityId,
      );
      expect(JSON.parse(JSON.stringify(mapping))).toEqual(legacyMapping);
      for (const [name, content] of Object.entries(files)) {
        const restored = name.startsWith("identity/")
          ? name.slice("identity/".length)
          : "plugin-state-legacy-home.json";
        expect(readFileSync(join(location, restored))).toEqual(content);
      }
      await withRouter(
        async (base) => {
          const response = await fetch(
            `${base}/backup/download?includeIdentity=true`,
          );
          expect(response.status).toBe(200);
          const zip = await unzipper.Open.buffer(
            Buffer.from(await response.arrayBuffer()),
          );
          const metadata = zip.files.find(
            (file) => file.path === "backup.json",
          );
          expect(metadata).toBeDefined();
          expect(
            JSON.parse((await metadata!.buffer()).toString()),
          ).toMatchObject({
            bridges: [legacyBridge],
            entityMappings: { [legacyBridge.id]: [legacyMapping] },
            includesIdentity: true,
          });
          for (const [name, content] of Object.entries(files)) {
            const file = zip.files.find((entry) => entry.path === name);
            expect(file).toBeDefined();
            expect(await file!.buffer()).toEqual(content);
          }
        },
        undefined,
        reloaded,
      );
    } finally {
      await reloaded.close();
    }
  });

  it("accepts a config-only legacy archive without replacing existing identity storage", async () => {
    const location = mkdtempSync(join(dir, "compat-config-only-"));
    const stores = await openStores(location);
    const identity = join(location, legacyBridge.id, "state.bin");
    mkdirSync(join(location, legacyBridge.id));
    const original = Buffer.from([1, 2, 255]);
    writeFileSync(identity, original);
    try {
      const archive = await legacyArchive({
        version: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
        bridges: [legacyBridge],
        entityMappings: { [legacyBridge.id]: [legacyMapping] },
      });
      await withRouter(
        async (base) => {
          const form = new FormData();
          form.append(
            "file",
            new Blob([Uint8Array.from(archive)]),
            "config-only.zip",
          );
          const response = await fetch(`${base}/backup/restore`, {
            method: "POST",
            body: form,
          });
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            bridgesRestored: 1,
            identitiesRestored: 0,
            errors: [],
          });
          expect(readFileSync(identity)).toEqual(original);
        },
        undefined,
        stores,
      );
    } finally {
      await stores.close();
    }
  });
});

describe("plugin state in backup and restore (#439 review)", () => {
  it("round-trips the plugin-state file through download and restore", async () => {
    const stateFile = join(dir, "plugin-state-b1.json");
    writeFileSync(stateFile, JSON.stringify({ camera: false }));
    await withRouter(async (base) => {
      const res = await fetch(`${base}/backup/download?includeIdentity=true`);
      expect(res.status).toBe(200);
      const zip = Buffer.from(await res.arrayBuffer());

      // The clean restore: the disabled state is gone from disk.
      unlinkSync(stateFile);

      const form = new FormData();
      form.append("file", new Blob([zip]), "backup.zip");
      form.append("options", JSON.stringify({ overwriteExisting: true }));
      const restore = await fetch(`${base}/backup/restore`, {
        method: "POST",
        body: form,
      });
      expect(restore.status).toBe(200);

      expect(existsSync(stateFile)).toBe(true);
      expect(JSON.parse(readFileSync(stateFile, "utf-8"))).toEqual({
        camera: false,
      });
    });
  });
});

describe("backup settings validation", () => {
  it("rejects values the settings form cannot send and stores valid ones", async () => {
    const stored: unknown[] = [];
    const settingsStorage = {
      backupSettings: { autoBackup: true, backupRetentionCount: 5 },
      setBackupSettings: async (next: unknown) => {
        stored.push(next);
      },
    } as unknown as AppSettingsStorage;
    await withRouter(async (base) => {
      const put = (body: unknown) =>
        fetch(`${base}/backup/settings`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      for (const body of [
        { backupRetentionCount: "abc" },
        { backupRetentionCount: 0 },
        { backupRetentionCount: 2.5 },
        { backupRetentionCount: 101 },
        { backupRetentionCount: null },
        { autoBackup: "yes" },
      ]) {
        expect((await put(body)).status).toBe(400);
      }
      expect(stored).toHaveLength(0);

      expect((await put({ backupRetentionCount: 3, extra: 1 })).status).toBe(
        200,
      );
      expect(stored).toEqual([{ backupRetentionCount: 3 }]);
    }, settingsStorage);
  });
});
