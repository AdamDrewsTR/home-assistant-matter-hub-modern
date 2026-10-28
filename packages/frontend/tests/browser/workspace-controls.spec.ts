import { expect, type Frame, test } from "@playwright/test";
import { expectWorkspaceFits } from "./layout-assertions";
import { bridgeExport, longName, mockWorkspace } from "./workspace-fixture";

for (const width of [320, 390, 430]) {
  for (const section of [
    "home",
    "bundles",
    "setup",
    "network",
    "endpoints",
    "hubs",
    "credentials",
    "plugins",
    "backup",
    "events",
  ]) {
    test(`embedded ${section} controls fit ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const { unexpected, errors } = await mockWorkspace(page);
      async function check(app: Frame, name: string) {
        await test.step(name, async () => {
          await expectWorkspaceFits(page, app, width);
          expect(unexpected).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
      async function go(path: string) {
        await page.goto(`/__embedded?path=${encodeURIComponent(path)}`);
        const app = page.frames().find((frame) => frame.parentFrame());
        if (!app) throw new Error("Embedded workspace frame is missing");
        // Measure settled layouts rather than animation frames.
        await app.addStyleTag({
          content:
            "*, ::before, ::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }",
        });
        await expect(app.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(app.locator(".MuiCircularProgress-root")).toHaveCount(0);
        await page.waitForLoadState("networkidle");
        return app;
      }
      async function cancel(app: Frame) {
        await app
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        await expect(app.getByRole("dialog")).toHaveCount(0);
      }

      if (section === "home") {
        const app = await go("/");
        await app.getByRole("combobox", { name: "Your hub" }).click();
        await check(app, "hub-menu");
        await app.getByRole("option").first().click();
        await app
          .getByRole("textbox", { name: "Search devices and entities" })
          .fill("Desk");
        await check(app, "search-results");
        await app
          .getByRole("textbox", { name: "Search devices and entities" })
          .clear();
        await app.getByRole("button", { name: longName, exact: true }).click();
        await check(app, "room-selected");
        await app.getByRole("button", { name: "Whole home" }).click();
        await app
          .locator("summary")
          .filter({ hasText: "Filter your home" })
          .click();
        await check(app, "inventory-filters");
        await app.getByRole("button", { name: "Change language" }).click();
        await check(app, "language-menu");
        await app.getByRole("button", { name: "Change language" }).click();
        await app.getByRole("button", { name: "System Logs" }).click();
        await expect(app.getByRole("dialog")).toBeVisible();
        await check(app, "logs");
      }
      if (section === "bundles") {
        const app = await go("/?hub=home&view=bundles");
        await app
          .getByRole("button", { name: "Edit bundle", exact: true })
          .click();
        await expect(
          app.getByText("Remove composed capabilities"),
        ).toBeVisible();
        await check(app, "device-editor");
        await app
          .getByRole("combobox", { name: "Additional capabilities" })
          .click();
        await expect(app.getByRole("listbox")).toBeVisible();
        await check(app, "capability-menu");
        await app.locator("body").press("Escape");
        await cancel(app);
        await app
          .getByRole("button", { name: "Build a custom device" })
          .click();
        await check(app, "custom-bundle");
        await app
          .getByRole("combobox", { name: "Primary shared entity" })
          .click();
        await app
          .getByRole("option")
          .filter({ hasText: "sensor.temperature" })
          .click();
        await app
          .getByRole("combobox", { name: "Additional capabilities" })
          .click();
        await app
          .getByRole("option")
          .filter({ hasText: "sensor.humidity" })
          .click();
        await app
          .getByRole("dialog")
          .getByRole("combobox", { name: longName, exact: true })
          .click();
        await app.getByRole("option", { name: /humidity sensor/i }).click();
        await check(app, "bundle-types");
        await app
          .getByRole("button", { name: "Preview bundle", exact: true })
          .click();
        await check(app, "bundle-review");
      }
      if (section === "setup") {
        const app = await go("/setup");
        await app.getByRole("button", { name: "Next", exact: true }).tap();
        await app.locator("body").evaluate(() => window.scrollTo(0, 0));
        await expect(
          app.getByRole("navigation", { name: "Your spaces" }),
        ).toBeVisible();
        await check(app, "setup-devices");
        const selectShown = app.getByText("Select shown", { exact: true });
        await selectShown.evaluate((element) =>
          element.scrollIntoView({ block: "center" }),
        );
        await expect(selectShown).toBeInViewport();
        await selectShown.tap();
        await app.getByRole("button", { name: "Next", exact: true }).tap();
        await check(app, "setup-review");
      }
      if (section === "network") {
        const app = await go("/system/network-check");
        await app
          .getByRole("button", { name: "Show details", exact: true })
          .click();
        await expect(app.getByRole("table")).toHaveCount(2);
        await check(app, "network-tables");
      }
      if (section === "endpoints") {
        const app = await go("/system/endpoints");
        await app.getByText("Clusters (1)", { exact: true }).nth(1).click();
        await check(app, "endpoint-details");
      }
      if (section === "hubs") {
        const app = await go("/system/hubs");
        await app.locator('input[type="file"]').setInputFiles({
          name: "hubs.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(bridgeExport)),
        });
        await expect(
          app.getByRole("dialog").getByText(longName, { exact: true }),
        ).toBeVisible();
        await check(app, "hub-import");
      }
      if (section === "credentials") {
        const app = await go("/system/credentials");
        await app.getByRole("button", { name: "Add Lock Credential" }).click();
        await check(app, "credential-editor");
      }
      if (section === "plugins") {
        const app = await go("/system/plugins");
        await app
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await check(app, "plugin-settings");
        await cancel(app);
        await app
          .getByRole("button", { name: "Install Plugin", exact: true })
          .click();
        await check(app, "plugin-install");
        await app.getByRole("tab", { name: "Upload .tgz" }).click();
        await check(app, "plugin-upload");
        await app.getByRole("tab", { name: "Local Path" }).click();
        await check(app, "plugin-path");
      }
      if (section === "backup") {
        const app = await go("/system/backup");
        await app.getByRole("button", { name: "Restore", exact: true }).click();
        await check(app, "backup-confirmation");
      }
      if (section === "events") {
        const app = await go("/system/events");
        await app.getByRole("button", { name: "Filter event types" }).click();
        await check(app, "event-filters");
      }
    });
  }
}
