import type { HomeAssistantFilter } from "@home-assistant-matter-hub/common";
import { expect, type Page, test } from "@playwright/test";
import { expectWorkspaceFits } from "./layout-assertions";
import { longName, mockWorkspace } from "./workspace-fixture";

async function openWorkspace(page: Page, path: string) {
  await page.goto(`/__embedded?path=${encodeURIComponent(path)}`);
  const app = page.frames().find((frame) => frame.parentFrame());
  if (!app) throw new Error("Embedded workspace frame is missing");
  await app.addStyleTag({
    content:
      "*, ::before, ::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }",
  });
  await expect(app.getByRole("heading", { level: 1 })).toBeVisible();
  return app;
}

for (const width of [320, 390, 430]) {
  test(`reviewed location enrollment and exclusions fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const { bridge, unexpected, errors } = await mockWorkspace(page);
    let saved = structuredClone(bridge);
    const writes: HomeAssistantFilter[] = [];
    await page.route(/\/api\/matter\/bridges(?:\?.*)?$/, (route) =>
      route.fulfill({ json: [saved] }),
    );
    await page.route("**/api/matter/bridges/home", async (route) => {
      expect(route.request().method()).toBe("PUT");
      const body = route.request().postDataJSON();
      writes.push(body.filter);
      saved = { ...saved, ...body };
      await route.fulfill({ json: saved });
    });
    let app = await openWorkspace(page, "/");
    await app.getByRole("radio", { name: "Follow rooms or floors" }).check();
    const locations = app.getByRole("combobox", {
      name: "Rooms and floors to follow",
    });
    await locations.click();
    await expectWorkspaceFits(page, app, width);
    await app.getByRole("option", { name: "Upstairs", exact: true }).click();
    await app.getByRole("option", { name: longName, exact: true }).click();
    await locations.press("Escape");
    await expect(app.getByRole("status")).toContainText("2 eligible entities");
    await expectWorkspaceFits(page, app, width);
    await page.screenshot({
      path: testInfo.outputPath("location-selection.png"),
    });
    await app.getByText("Customize what is shared (0 exclusions)").click();
    await app
      .getByRole("combobox", { name: "Individual entities to leave out" })
      .click();
    await expectWorkspaceFits(page, app, width);
    await app
      .getByRole("option")
      .filter({ hasText: "sensor.humidity" })
      .click();
    await expect(app.getByRole("status")).toContainText("1 eligible entity");
    await expectWorkspaceFits(page, app, width);
    await page.screenshot({
      path: testInfo.outputPath("location-customization.png"),
    });
    expect(writes).toEqual([]);
    await app
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    const dialog = app.getByRole("dialog");
    await expect(dialog).toContainText("Following: Upstairs");
    await expect(dialog).toContainText(
      "Diagnostic/configuration entities: No.",
    );
    await expect(dialog).toContainText(
      "future eligible additions and removals",
    );
    await expectWorkspaceFits(page, app, width);
    await page.screenshot({ path: testInfo.outputPath("location-review.png") });
    await dialog
      .getByRole("checkbox", {
        name: "I reviewed the changes and their impact",
      })
      .check();
    await dialog
      .getByRole("button", { name: "Apply changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({
      include: [],
      exclude: [],
      location: {
        areaIds: ["office"],
        floorIds: ["upstairs"],
        excludedDeviceIds: [],
        excludedEntityIds: ["sensor.humidity"],
      },
    });
    app = await openWorkspace(page, "/");
    await expect(
      app.getByRole("radio", { name: "Follow rooms or floors" }),
    ).toBeChecked();
    await expect(app.getByRole("status")).toContainText("1 eligible entity");
    await expect(
      app.getByRole("button", { name: "Apply changes", exact: true }),
    ).toHaveCount(0);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("creates a hub following an empty room without flattening its future enrollment", async ({
  page,
}) => {
  const { bridge, unexpected, errors } = await mockWorkspace(page);
  let saved = bridge;
  const created: HomeAssistantFilter[] = [];
  await page.route("**/api/matter/filter-preview", (route) =>
    route.fulfill({ json: { total: 0, entityIds: [] } }),
  );
  await page.route(/\/api\/matter\/bridges(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      created.push(body.filter);
      saved = { ...bridge, ...body };
      await route.fulfill({ json: saved });
    } else await route.fulfill({ json: [saved] });
  });
  const app = await openWorkspace(page, "/setup");
  await app.getByRole("button", { name: "Next", exact: true }).tap();
  await app.getByRole("radio", { name: "Follow rooms or floors" }).check();
  await app
    .getByRole("combobox", { name: "Rooms and floors to follow" })
    .click();
  await app.getByRole("option", { name: "Hallway", exact: true }).click();
  await app
    .getByRole("combobox", { name: "Rooms and floors to follow" })
    .press("Escape");
  await expect(app.getByRole("status")).toContainText("0 eligible entities");
  await app.getByRole("button", { name: "Next", exact: true }).tap();
  await expect(app.getByText(/Following: Hallway/)).toBeVisible();
  expect(created).toEqual([]);
  await app.getByRole("button", { name: "Create hub and pair" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0].location?.areaIds).toEqual(["hall"]);
  expect(created[0].include).toEqual([]);
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});
