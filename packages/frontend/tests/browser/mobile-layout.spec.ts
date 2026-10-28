import { expect, test } from "@playwright/test";

const areas = Array.from({ length: 10 }, (_, index) => ({
  area_id: `room_${index}`,
  name: index === 0 ? `Office_${"long_name_".repeat(12)}` : `Room ${index}`,
}));
const entities = areas.map((area, index) => ({
  entity_id: `sensor.temperature_${index}`,
  friendly_name: `Temperature_${"long_entity_name_".repeat(8)}`,
  domain: "sensor",
  device_id: `device_${index}`,
  device_name: `Room monitor ${index}`,
  device_area_id: area.area_id,
  manufacturer: `Manufacturer_${"long_model_".repeat(12)}`,
  state: "21.4",
  attributes: { device_class: "temperature", unit_of_measurement: "°C" },
}));

for (const width of [320, 390, 430, 1280]) {
  test(`embedded device tiles fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/home-assistant/entities?*", (route) =>
      route.fulfill({ json: { total: entities.length, entities } }),
    );
    await page.route("**/api/matter/areas?*", (route) =>
      route.fulfill({ json: areas }),
    );
    await page.route("**/__embedded", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html, body { margin: 0; height: 100%; }
            header { height: 40px; }
            iframe { display: block; width: 100%; height: calc(100% - 40px); border: 0; }
          </style>
          </head><body><header>Home Assistant</header>
          <iframe title="Matter Hub Modern" src="/tests/browser/picker.html"></iframe></body></html>`,
      }),
    );
    await page.goto("/__embedded");
    const app = page.frameLocator('iframe[title="Matter Hub Modern"]');
    const tiles = app.locator(".MuiCard-root");
    await expect(tiles).toHaveCount(entities.length);

    async function expectFits() {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      const bounds = await tiles.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width };
        }),
      );
      for (const rect of bounds) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(width);
        expect(rect.width).toBeLessThanOrEqual(width - 32);
      }
      expect(
        await app.locator("html").evaluate((html) => html.scrollWidth),
      ).toBe(width);
    }

    await expectFits();
    await app
      .locator("summary")
      .filter({ hasText: "Choose entities" })
      .first()
      .click();
    await expectFits();
    await app.getByRole("button", { name: areas[0].name, exact: true }).click();
    await expect(tiles).toHaveCount(1);
    await expectFits();
  });
}
