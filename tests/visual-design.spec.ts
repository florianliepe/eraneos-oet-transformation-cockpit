import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

async function openCockpit(page: import("@playwright/test").Page) {
  await page.route("https://workflow.test/webhook/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, source: "bootstrap", storageConfigured: true, document: bootstrapPmoData }),
    });
  });
  await page.goto("/?view=register");
  await page.getByLabel("Display name").fill("Visual Tester");
  await page.getByLabel("Email").fill("visual@example.com");
  await page.getByLabel("Local demonstration password").fill("visual-local-password");
  await page.getByLabel(/I accept the applicable terms/).check();
  await page.getByRole("button", { name: "Create local account" }).click();
  await page.getByLabel("Temporary workspace credential").fill("visual-test-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Executive overview" })).toBeVisible();
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`renders the Eraneos shell at ${viewport.name} width`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openCockpit(page);

    const brand = page.getByLabel("eraneos Transformation Cockpit, part of OET AI Suite");
    await expect(brand).toBeVisible();
    await expect(brand.locator("img")).toHaveJSProperty("complete", true);
    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        ink: styles.getPropertyValue("--brand-ink").trim(),
        accent: styles.getPropertyValue("--brand-orange").trim(),
        canvas: styles.getPropertyValue("--brand-warm-gray").trim(),
      };
    });
    expect(tokens).toEqual({ ink: "#202020", accent: "#ff5a36", canvas: "#f0ebe7" });

    await testInfo.attach(`eraneos-overview-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("covers the branded operational workbenches and keyboard focus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCockpit(page);

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const view of ["Workbench intake", "PMO registers", "SteerCo summary"]) {
    await navigation.getByRole("button", { name: view }).click();
    await testInfo.attach(`eraneos-${view.toLowerCase().replaceAll(" ", "-")}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }

  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
});

test("captures empty, loading, error and recovery states", async ({ page }, testInfo) => {
  await openCockpit(page);
  await page.getByRole("button", { name: "Agent review inbox" }).click();
  await expect(page.getByRole("heading", { name: "No proposal sets waiting" })).toBeVisible();
  await testInfo.attach("state-empty-review", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  await page.getByRole("button", { name: "Workbench intake", exact: true }).click();
  await page.getByLabel("Write a project update").fill("Recovery-state visual verification.");
  await page.getByRole("button", { name: "Analyse and update workbench" }).click();
  await page.getByRole("button", { name: "Agent operations" }).click();
  await expect(page.getByText(/attempt 1/).first()).toBeVisible();
  await testInfo.attach("state-recovery-ready", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  await page.reload();
  await page.unroute("https://workflow.test/webhook/**");
  await page.route("https://workflow.test/webhook/**", async (route) => { await new Promise((resolve) => setTimeout(resolve, 450)); await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Controlled visual failure" }) }); });
  await page.getByLabel("Temporary workspace credential").fill("visual-test-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("status")).toContainText("Connecting to the project control tower");
  await testInfo.attach("state-loading", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await expect(page.getByRole("alert").filter({ hasText: "Controlled visual failure" })).toBeVisible();
  await testInfo.attach("state-error", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
