import { expect, test } from "@playwright/test";
import { expectWorkspaceFits } from "./layout-assertions";
import { mockWorkspace } from "./workspace-fixture";

const routes = [
  "/",
  "/?hub=home&view=pair",
  "/?hub=home&view=bundles",
  "/?hub=home&view=health",
  ...["configuration", "mappings", "diagnostics", "maintenance"].map(
    (section) => `/?hub=home&view=advanced&section=${section}`,
  ),
  "/setup",
  "/setup?advanced=true",
  ...[
    "hubs",
    "endpoints",
    "standalone",
    "areas",
    "startup",
    "network",
    "credentials",
    "filters",
    "plugins",
    "health",
    "events",
    "network-check",
    "system-info",
    "backup",
    "updates",
    "recovery",
    "access",
    "translations",
  ].map((tool) => `/system/${tool}`),
];

for (const width of [320, 390, 430]) {
  for (const path of routes) {
    test(`embedded workspace fits ${width}px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const { unexpected, errors } = await mockWorkspace(page);
      await page.goto(`/__embedded?path=${encodeURIComponent(path)}`);
      if (path !== "/system/areas") await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
      const app = page.frameLocator('iframe[title="Matter Hub Modern"]');
      await expect(app.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(app.locator(".MuiCircularProgress-root")).toHaveCount(0);
      // Let lazy sections and their fixture requests settle before measuring layout.
      if (path !== "/system/areas") await page.waitForLoadState("networkidle");
      await expectWorkspaceFits(page, app, width);
      expect(unexpected, path).toEqual([]);
      expect(errors, path).toEqual([]);
    });
  }
}
