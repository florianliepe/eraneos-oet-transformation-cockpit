import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

function luminance(hex: string) {
  const rgb = hex.match(/[a-f\d]{2}/gi)?.map((value) => parseInt(value, 16) / 255) || [];
  const linear = rgb.map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + .05) / (values[1] + .05);
}

test.beforeEach(async ({ page }) => {
  await page.route("https://workflow.test/webhook/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, source: "bootstrap", storageConfigured: true, document: bootstrapPmoData }) }));
  await page.goto("/?view=register");
  await page.getByLabel("Display name").fill("Accessibility Tester");
  await page.getByLabel("Email").fill("accessibility@example.com");
  await page.getByLabel("Local demonstration password").fill("accessibility-local-password");
  await page.getByLabel(/I accept the applicable terms/).check();
  await page.getByRole("button", { name: "Create local account" }).click();
  await page.getByLabel("Organisation name").fill("Accessibility Test Office");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await page.getByLabel("Project name").fill("Accessibility Project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Open cockpit" }).click();
  await page.getByLabel("Temporary workspace credential").fill("accessibility-test");
  await page.getByRole("button", { name: "Open workspace" }).click();
});

test("supports skip navigation, global shortcut and named interactive controls", async ({ page }) => {
  const skipLink = page.getByRole("link", { name: "Skip to cockpit content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#cockpit-content")).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Search project")).toBeFocused();
  const unnamed = await page.locator("button:visible").evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim() || button.getAttribute("title"))).length);
  expect(unnamed).toBe(0);
});

test("keeps critical brand and status text above WCAG AA contrast", async ({ page }) => {
  const colours = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return { ink: styles.getPropertyValue("--brand-ink").trim(), canvas: styles.getPropertyValue("--brand-warm-gray").trim(), action: styles.getPropertyValue("--brand-orange-deep").trim() };
  });
  expect(contrast(colours.ink, colours.canvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colours.action, "#ffffff")).toBeGreaterThanOrEqual(4.5);
});
