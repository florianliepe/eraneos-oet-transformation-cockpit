import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("https://workflow.test/**", async (route) => {
    const body = route.request().postDataJSON() as { mode?: string; document?: typeof bootstrapPmoData };
    if (body.mode === "pmo.save" && body.document) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, source: "github", storageConfigured: true, document: { ...body.document, revision: body.document.revision + 1 } }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, source: "bootstrap", storageConfigured: false, document: bootstrapPmoData }),
    });
  });
  await page.goto("/");
  await page.getByLabel("Temporary workspace credential").fill("test-workspace-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
});

test("opens the product-neutral executive workspace without client errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByRole("heading", { name: "Executive overview" })).toBeVisible();
  await expect(page.getByLabel("eraneos Transformation Cockpit, part of OET AI Suite")).toBeVisible();
  await expect(page.getByText("part of OET AI Suite")).toBeVisible();
  expect(errors).toEqual([]);
});

test("navigates through the retained core delivery views", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const name of ["Workbench intake", "Plan & deliverables", "Risks & issues", "Meeting hub", "Activity log", "SteerCo summary"]) {
    await navigation.getByRole("button", { name }).click();
  }
  await expect(page.getByRole("heading", { name: "SteerCo summary", level: 1 })).toBeVisible();
});

test("captures a governed risk update", async ({ page }) => {
  await page.getByRole("button", { name: "Quick add" }).click();
  await page.getByLabel("Title").fill("Decision latency threatens the next gate");
  await page.getByLabel("Owner").fill("Programme Director");
  await page.getByLabel("Mitigation").fill("Pre-wire decisions before the gate review.");
  await page.getByLabel("Description").fill("Open decisions are not closing within the agreed cadence.");
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await page.getByRole("button", { name: "Risks & issues" }).click();
  await expect(page.getByText("Decision latency threatens the next gate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish changes" })).toBeEnabled();
});
