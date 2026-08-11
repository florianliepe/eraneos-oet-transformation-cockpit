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

test("reviews field-level agent proposals before governed publication", async ({ page }) => {
  const risk = bootstrapPmoData.risks[0];
  const proposalSet = {
    contractVersion: "proposal-set-1.0",
    id: "PS-agent-browser-test",
    sourceExecutionId: "agent:browser-test",
    correlationId: "browser-test",
    sourceRevision: bootstrapPmoData.revision,
    status: "pending_review",
    createdAt: "2026-08-11T11:00:00.000Z",
    evidence: [{ id: "EVD-BROWSER-1", label: "Status update", verified: true }],
    proposals: [{ id: "PROP-BROWSER-1", sourceExecutionId: "agent:browser-test", workflowId: "risk.analyse", entity: "risk", action: "update", objectId: risk.id, expectedObjectVersion: risk.governance.version, summary: "Increase risk impact", risk: "high", evidenceIds: ["EVD-BROWSER-1"], fieldChanges: [{ field: "impact", before: risk.impact, after: 5 }], proposedObject: { ...risk, impact: 5 } }],
    audit: [{ id: "PAUD-BROWSER-1", event: "proposal.generated", actor: "PMO Orchestrator", at: "2026-08-11T11:00:00.000Z", sourceExecutionId: "agent:browser-test" }],
  };
  const modes: string[] = [];
  await page.unroute("https://workflow.test/webhook/**");
  await page.route("https://workflow.test/webhook/**", async (route) => {
    const body = route.request().postDataJSON() as { mode?: string; reviewBundle?: unknown };
    modes.push(body.mode || "");
    if (body.mode === "pmo.ingest") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, source: "github", storageConfigured: true, document: bootstrapPmoData, proposalSet }) });
    if (body.mode === "pmo.review") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, reviewBundle: body.reviewBundle }) });
    if (body.mode === "pmo.publish") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, duplicate: false, proposalSetId: proposalSet.id, reviewBundleId: "REV-PS-agent-browser-test-20260811110000", idempotencyKey: "REV-PS-agent-browser-test-20260811110000", acceptedProposalIds: ["PROP-BROWSER-1"], rejectedProposalIds: [], revision: bootstrapPmoData.revision + 1, document: { ...bootstrapPmoData, revision: bootstrapPmoData.revision + 1 } }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, source: "bootstrap", storageConfigured: false, document: bootstrapPmoData }) });
  });
  await page.reload();
  await page.getByLabel("Temporary workspace credential").fill("test-workspace-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Workbench intake", exact: true }).click();
  await page.getByLabel("Write a project update").fill("The verified status note increases the governed risk impact.");
  await page.getByRole("button", { name: "Analyse and update workbench" }).click();
  await page.getByRole("button", { name: /Agent review inbox/ }).click();
  await expect(page.getByRole("heading", { name: "Review agent proposals" })).toBeVisible();
  const card = page.getByRole("article");
  await expect(card.getByText("Increase risk impact")).toBeVisible();
  await expect(card.getByText(String(risk.impact), { exact: true })).toBeVisible();
  await expect(card.getByText("5", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await card.getByRole("textbox").fill("Verified status evidence supports this accountable risk update.");
  await page.getByRole("button", { name: "Record review and publish accepted" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  expect(modes).toEqual(expect.arrayContaining(["pmo.ingest", "pmo.review", "pmo.publish"]));
});

test("shows immutable run history and replays the original input with lineage", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  page.on("request", (request) => { if (request.url().includes("workflow.test/webhook")) requests.push(request.postDataJSON()); });
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Workbench intake", exact: true }).click();
  await page.getByLabel("Write a project update").fill("A traced dependency update for operations testing.");
  await page.getByRole("button", { name: "Analyse and update workbench" }).click();
  await page.reload();
  await page.getByLabel("Temporary workspace credential").fill("test-workspace-credential");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Agent operations" }).click();
  await expect(page.getByRole("heading", { name: "Recoverable agent executions" })).toBeVisible();
  await expect(page.getByText(/attempt 1/).first()).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replay current version" }).click();
  await expect(page.getByText(/Replay Of/i)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Operations lead"));
  await page.getByRole("button", { name: "Assign" }).first().click();
  await expect(page.getByText("Operations lead").first()).toBeVisible();
  await page.getByRole("button", { name: "Resolve" }).first().click();
  await expect(page.locator(".agent-ops-governance").first().getByText("Resolved", { exact: true })).toBeVisible();
  const ingests = requests.filter((request) => request.mode === "pmo.ingest") as Array<{ meta?: Record<string, string> }>;
  expect(ingests).toHaveLength(2);
  expect(ingests[1].meta?.replay_of).toBeTruthy();
  expect(ingests[1].meta?.correlation_id).toBe(ingests[0].meta?.correlation_id);
});

test("shows release-aligned operational health and ownership", async ({ page }) => {
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Operational health" }).click();
  await expect(page.getByRole("heading", { name: "Operational health", level: 1 })).toBeVisible();
  await expect(page.getByText("2026-08-11-zm-prod-09a")).toBeVisible();
  await expect(page.getByText("pEIhI533jPQvvSzs")).toBeVisible();
  await expect(page.getByText("4czGSZtMjeGpKSFS")).toBeVisible();
  await expect(page.getByText("BkHWDRmPvXOepELU")).toBeVisible();
  await expect(page.getByText(/30 cases/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baseline versus candidate quality" })).toBeVisible();
  await expect(page.getByText("quality-expanded-1.1")).toBeVisible();
  await expect(page.getByText("None. Candidate meets every blocking and warning threshold.")).toBeVisible();
  await expect(page.getByText("OET AI Suite workflow administrator")).toBeVisible();
});
