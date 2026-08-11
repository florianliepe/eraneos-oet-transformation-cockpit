import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

test("serves the static cockpit under the GitHub project path with working assets and n8n access", async ({ page }) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => { if (response.status() >= 400 && response.url().includes("127.0.0.1:3108")) failedAssets.push(`${response.status()} ${response.url()}`); });
  await page.route("https://eraneos-agentic-platform.azurewebsites.net/webhook/a2126107-4e70-4717-8f1c-545d7f310741", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, source: "bootstrap", storageConfigured: true, document: bootstrapPmoData }) });
  });
  await page.goto("./?view=signin");
  await expect(page).toHaveURL(/\/eraneos-oet-transformation-cockpit\/\?view=signin$/);
  await expect(page.getByLabel("eraneos Transformation Cockpit, part of OET AI Suite")).toBeVisible();
  await page.getByLabel("Temporary workspace credential").fill("pages-test-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Executive overview" })).toBeVisible();
  const publicText = await page.locator("body").innerText();
  expect(publicText).not.toMatch(/[âÂÃ]/);
  expect(publicText).not.toContain("Florian Liepe");
  expect(failedAssets).toEqual([]);
});
