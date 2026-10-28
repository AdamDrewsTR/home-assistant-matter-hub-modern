import {
  type HomeAssistantFilter,
  matchesLocationSharing,
} from "@home-assistant-matter-hub/common";
import type { Page } from "@playwright/test";

export const longName =
  "Office_with_a_long_unbroken_Home_Assistant_name_".repeat(3);
export const hubName = "Home_with_a_long_unbroken_name";
const locationAreas = [
  { area_id: "office", name: longName, floor_id: "upstairs" },
  { area_id: "hall", name: "Hallway", floor_id: "downstairs" },
];
const entities = [
  {
    entity_id: "sensor.temperature",
    friendly_name: "Temperature",
    domain: "sensor",
    device_id: "monitor",
    device_name: longName,
    device_area_id: "office",
    state: "21.4",
    attributes: { device_class: "temperature", unit_of_measurement: "°C" },
  },
  {
    entity_id: "sensor.humidity",
    friendly_name: longName,
    domain: "sensor",
    device_id: "monitor",
    device_name: longName,
    device_area_id: "office",
    state: "unavailable",
    attributes: { device_class: "humidity", unit_of_measurement: "%" },
  },
  {
    entity_id: "light.desk",
    friendly_name: "Desk lamp",
    domain: "light",
    device_id: "desk",
    device_name: "Desk lighting",
    device_area_id: "hall",
    state: "on",
    attributes: { supported_color_modes: ["brightness"] },
  },
];
const bridge = {
  id: "home",
  name: hubName,
  port: 5540,
  status: "running",
  deviceCount: 3,
  filter: { include: [{ type: "pattern", value: "*" }], exclude: [] },
  featureFlags: { stableIdentity: true },
  basicInformation: {
    vendorId: 1,
    vendorName: "Demo",
    productId: 1,
    productName: "Hub",
    productLabel: "Demo",
    hardwareVersion: 1,
    softwareVersion: 1,
  },
  commissioning: {
    isCommissioned: false,
    passcode: 20202021,
    discriminator: 3840,
    manualPairingCode: "34970112332",
    qrPairingCode: "MT:Y.K9042C00KA0648G00",
    fabrics: [],
  },
};
export const bridgeExport = {
  version: 1,
  exportedAt: new Date().toISOString(),
  bridges: [bridge],
};
const endpoint = {
  id: { global: "root", local: "root" },
  type: { name: "Aggregator", id: "14" },
  endpoint: 0,
  state: {},
  parts: entities.map((entity, index) => ({
    id: { global: entity.entity_id, local: entity.entity_id },
    type: { name: "TemperatureSensor", id: "770" },
    endpoint: index + 1,
    state: {
      bridgedDeviceBasicInformation: {
        nodeLabel: entity.friendly_name,
        reachable: true,
      },
      homeAssistant: {
        entity: {
          entity_id: entity.entity_id,
          state: { state: entity.state, attributes: entity.attributes },
        },
      },
    },
    parts: [],
  })),
};
const network = {
  timestamp: new Date().toISOString(),
  interfaces: [
    {
      name: "eth0",
      ipv4: ["192.168.1.12"],
      ipv6: ["fe80::abcd:1234:5678:90ab"],
      mac: "ab:cd:ef:12:34:56",
      internal: false,
    },
  ],
  checks: [
    {
      name: "ipv6_available",
      status: "warn",
      message: "Verify IPv6 on the local network",
      detail: longName,
    },
  ],
  matterConfig: { boundInterface: null, ipv4Enabled: true },
};
const health = {
  status: "healthy",
  version: "0.0.0-dev",
  uptime: 100,
  timestamp: new Date().toISOString(),
  services: {
    bridges: { total: 1, running: 1, stopped: 0, failed: 0 },
    homeAssistant: { connected: true },
  },
  bridgeDetails: [
    { ...bridge, fabricCount: 0, fabrics: [], failedEntityCount: 0 },
  ],
  recovery: { enabled: true, recoveryCount: 0, history: [] },
};

export async function mockWorkspace(page: Page) {
  const unexpected: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("mui-mode", "dark");
  });
  await page.addInitScript(
    (snapshot) => {
      class FixtureSocket extends EventTarget {
        readyState: number = WebSocket.OPEN;
        onopen: (() => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        constructor() {
          super();
          queueMicrotask(() => this.onopen?.());
        }
        send(message: string) {
          if (
            message.includes("subscribe_diagnostics") &&
            !message.includes("unsubscribe")
          ) {
            queueMicrotask(() =>
              this.onmessage?.(
                new MessageEvent("message", {
                  data: JSON.stringify({
                    type: "diagnostic_snapshot",
                    data: snapshot,
                  }),
                }),
              ),
            );
          }
        }
        close() {
          this.readyState = WebSocket.CLOSED;
        }
      }
      window.WebSocket = new Proxy(WebSocket, {
        construct(target, args) {
          return String(args[0]).endsWith("/api/ws")
            ? new FixtureSocket()
            : Reflect.construct(target, args);
        },
      });
    },
    {
      timestamp: Date.now(),
      bridges: [
        {
          bridgeId: "home",
          bridgeName: hubName,
          status: "running",
          uptime: 100,
          entityCount: 3,
          sessionCount: 0,
          subscriptionCount: 0,
          featureFlags: {},
          entities: [],
        },
      ],
      recentEvents: [
        {
          id: "event",
          timestamp: Date.now(),
          type: "entity_error",
          bridgeId: "home",
          bridgeName: hubName,
          entityId: "sensor.temperature",
          message: longName,
        },
      ],
      system: { uptime: 100, memoryMB: 100, eventCount: 1 },
    },
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    const path = new URL(request.url()).pathname.replace(/^.*\/api\//, "");
    const responses: Record<string, unknown> = {
      health,
      "health/detailed": health,
      "matter/bridges": [bridge],
      "matter/bridges/home/devices": endpoint,
      "entity-mappings/home": {
        bridgeId: "home",
        mappings: [
          {
            entityId: "sensor.temperature",
            customName: longName,
            composeDevice: true,
            composedEntities: [
              {
                entityId: "sensor.humidity",
                matterDeviceType: "humidity_sensor",
              },
            ],
          },
        ],
      },
      "home-assistant/entities": { total: entities.length, entities },
      "matter/areas": [
        { area_id: "office", name: longName },
        { area_id: "hall", name: "Hallway" },
      ],
      "matter/locations": {
        areas: locationAreas,
        floors: [
          { floor_id: "upstairs", name: "Upstairs" },
          { floor_id: "downstairs", name: "Downstairs" },
        ],
      },
      "matter/areas/summary": [
        {
          area_id: "office",
          name: longName,
          entityCount: 3,
          domains: { sensor: 3 },
        },
      ],
      "matter/labels": [{ label_id: "label", name: longName }],
      "matter/filter-values": {
        domains: ["sensor", "light"],
        platforms: [],
        entityCategories: [],
        deviceClasses: ["temperature"],
        deviceNames: [longName],
        productNames: [],
      },
      "matter/filter-preview": {
        total: entities.length,
        entities,
        entityIds: entities.map((entity) => entity.entity_id),
        truncated: false,
      },
      "bridge-icons/home/exists": { exists: false },
      "device-images/resolve": {},
      network,
      "backup/snapshots": [
        {
          filename: `${longName}.json`,
          version: "4.2.0-modern.5",
          createdAt: new Date().toISOString(),
          sizeBytes: 12345,
          auto: false,
        },
      ],
      "backup/settings": { autoBackup: false, backupRetentionCount: 5 },
      "settings/auth": { enabled: false, source: "none" },
      "settings/recovery": {
        autoRecoveryEnabled: true,
        recoveryIntervalMs: 60000,
      },
      "lock-credentials": {
        credentials: [
          {
            entityId: `lock.${longName}`,
            name: longName,
            enabled: true,
            hasPinCode: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      },
      plugins: [
        {
          bridgeId: "home",
          bridgeName: hubName,
          plugins: [
            {
              name: longName,
              version: "1.0",
              source: "builtin",
              enabled: true,
              config: {},
              devices: [{ id: "demo", name: longName, deviceType: "sensor" }],
            },
          ],
        },
      ],
      "plugins/installed": [],
      "bridges/import/preview": {
        version: 1,
        exportedAt: bridgeExport.exportedAt,
        bridges: [
          {
            id: "imported",
            name: longName,
            port: 5541,
            entityCount: 3,
            exists: false,
          },
        ],
      },
      [`plugins/home/${longName}/config-schema`]: {
        schema: {
          title: longName,
          properties: { demo: { type: "string", title: longName } },
        },
        config: { demo: longName },
      },
      "system/info": {
        version: "4.2.0-modern.5",
        nodeVersion: "v24",
        hostname: longName,
        platform: "linux",
        arch: "arm64",
        uptime: 123,
        cpuCount: 4,
        cpuModel: longName,
        loadAvg: [0.1, 0.2, 0.3],
        environment: "Home Assistant Add-on",
        memory: { total: 4096, used: 1024, free: 3072, usagePercent: 25 },
        storage: { total: 4096, used: 1024, free: 3072, usagePercent: 25 },
        network: {
          interfaces: [
            {
              name: "eth0",
              address: "fe80::abcd:1234:5678:90ab",
              family: "IPv6",
              mac: "ab:cd:ef:12:34:56",
              internal: false,
            },
          ],
        },
        process: {
          pid: 1,
          uptime: 100,
          rss: 1024,
          memoryUsage: 1024,
          heapTotal: 2048,
          heapUsed: 1024,
          heapSizeLimit: 4096,
          external: 12,
        },
      },
      "system/update-check": {
        currentVersion: "4.2.0-modern.5",
        latestVersion: "4.2.0-modern.5",
        updateAvailable: false,
        releaseUrl: "https://example.invalid/release",
        publishedAt: new Date().toISOString(),
        environment: "Home Assistant Add-on",
      },
      logs: {
        entries: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            message: longName,
            logger: longName,
          },
        ],
      },
    };
    if (path === "matter/filter-preview" && request.method() === "POST") {
      const filter = request.postDataJSON() as HomeAssistantFilter;
      const location = filter.location;
      if (location) {
        const matching = entities.filter((entity) =>
          matchesLocationSharing(
            location,
            { ...entity, device_id: entity.device_id || "" },
            { id: entity.device_id, area_id: entity.device_area_id },
            locationAreas,
          ),
        );
        await route.fulfill({
          json: {
            total: matching.length,
            entityIds: matching.map((entity) => entity.entity_id),
          },
        });
        return;
      }
    }
    if (path.endsWith("/icon")) {
      await route.fulfill({ status: 404 });
    } else if (
      path in responses &&
      (request.method() === "GET" ||
        [
          "matter/filter-preview",
          "device-images/resolve",
          "bridges/import/preview",
        ].includes(path))
    ) {
      await route.fulfill({ json: responses[path] });
    } else {
      unexpected.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 500,
        json: { error: `Unexpected fixture request: ${path}` },
      });
    }
  });
  await page.route("**/__embedded*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
      html, body { margin: 0; height: 100%; }
      header { height: 40px; }
      iframe { display: block; width: 100%; height: calc(100% - 40px); border: 0; }
      </style></head><body><header>Home Assistant</header>
      <iframe title="Matter Hub Modern" src="${new URL(route.request().url()).searchParams.get("path") || "/"}"></iframe></body></html>`,
    }),
  );
  return { unexpected, errors, bridge };
}
