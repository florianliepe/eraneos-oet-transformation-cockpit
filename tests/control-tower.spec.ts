import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("https://workflow.test/webhook/**", async (route) => {
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
  for (const name of ["Workbench intake", "Plan & deliverables", "Risk register", "PMO registers", "Meeting hub", "Activity log", "SteerCo summary"]) {
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
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: /Risk register/ }).click();
  await expect(page.getByText("Decision latency threatens the next gate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish changes" })).toBeEnabled();
});

test("creates a governed first-class issue and exposes governance records", async ({ page }) => {
  await page.getByRole("button", { name: "PMO registers" }).click();
  await expect(page.getByRole("heading", { name: "Governed registers" })).toBeVisible();
  await page.getByRole("button", { name: "Add issue" }).click();
  await page.getByLabel("Title").fill("Cross-workstream design conflict");
  await page.getByLabel("Description").fill("Two workstreams require incompatible interface assumptions.");
  await page.getByRole("textbox", { name: "Owner" }).fill("PMO Lead");
  await page.getByLabel("Resolution").fill("Convene a design authority decision.");
  await page.getByRole("button", { name: "Add to workbench" }).click();
  await expect(page.getByText("Cross-workstream design conflict")).toBeVisible();
  await page.getByRole("tab", { name: "Evidence & governance" }).click();
  await expect(page.getByRole("heading", { name: "Evidence register" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Object versions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit events" })).toBeVisible();
});

test("shows a traceable agent execution contract for legacy workflow responses", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Workbench intake" }).click();
  await page.getByLabel("Write a project update").fill("A delivery dependency may affect the next milestone.");
  await page.getByRole("button", { name: "Analyse and update workbench" }).click();

  const result = page.getByLabel("Agent execution result");
  await expect(result).toBeVisible();
  await expect(result.getByText("agent-run-1.0")).toBeVisible();
  await expect(result.getByText("Legacy Direct")).toBeVisible();
  await expect(result.getByText("LEGACY_DIRECT_PERSISTENCE")).toBeVisible();
  await expect(result.getByText("Evidence verifier")).toBeVisible();
  await expect(result.getByText("Governance reviewer")).toBeVisible();
});
