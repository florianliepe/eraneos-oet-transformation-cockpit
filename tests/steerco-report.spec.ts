import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { buildCorePmoSummary } from "../src/lib/reporting-schema";
import {
  applySteercoApproval,
  applySteercoRagOverride,
  assertSteercoSourcesCurrent,
  buildSteercoEnvelope,
  buildSteercoEvidence,
  rejectSteercoDraft,
  resolveSteercoPeriod,
  SteercoSnapshotSchema,
} from "../src/lib/steerco-schema";

const pmo = structuredClone(bootstrapPmoData);
pmo.revision = 12;
pmo.project.updatedAt = "2026-08-08T10:00:00.000Z";
pmo.meetings[0].date = "2026-08-01";
pmo.meetings[0].type = "steering";
pmo.milestones[0].date = "2026-08-20";
pmo.milestones[0].status = "at_risk";
pmo.deliverables[0].dueDate = "2026-08-05";
pmo.deliverables[0].status = "blocked";
pmo.risks[0].probability = 4;
pmo.risks[0].impact = 5;
pmo.actions[0].dueDate = "2026-08-03";
pmo.issues[0].severity = 5;

const envelope = (period = resolveSteercoPeriod("current_month", pmo, new Date("2026-08-10T12:00:00Z"))) =>
  buildSteercoEnvelope(pmo, [buildCorePmoSummary(pmo)], period, new Date("2026-08-10T12:00:00Z"));

test("resolves adjustable reporting periods", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  expect(resolveSteercoPeriod("current_month", pmo, now)).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  expect(resolveSteercoPeriod("previous_month", pmo, now)).toMatchObject({ from: "2026-07-01", to: "2026-07-31" });
  expect(resolveSteercoPeriod("since_last_steerco", pmo, now)).toMatchObject({ from: "2026-08-01", to: "2026-08-10" });
});
test("derives red status and retains neutral module lineage", () => {
  const snapshot = buildSteercoEvidence(envelope(), "PMO Lead");
  expect(snapshot.rag.calculated).toBe("red");
  expect(snapshot.rag.signals.find((item) => item.id === "critical-risks")?.sourceIds).toContain("R-1");
  expect(snapshot.sourceRevision.modules["core-pmo"]).toBe(12);
  expect(SteercoSnapshotSchema.safeParse(snapshot).success).toBe(true);
});

test("blocks approval until an evidence-linked narrative exists", () => {
  const snapshot = buildSteercoEvidence(envelope(), "PMO Lead");
  expect(() => applySteercoApproval(snapshot, "Sponsor", "Reviewed cited evidence.")).toThrow(/Generate and review/);
  const generated = { ...snapshot, executiveSummary: [{ id: "AI-1", text: "A critical risk and blocked deliverable require Steering Committee attention.", kind: "ai_narrative" as const, sourceIds: ["R-1", "DEL-1"] }] };
  expect(applySteercoApproval(generated, "Sponsor", "Reviewed sources.").status).toBe("approved");
});

test("rejects inverted periods and stale source revisions", () => {
  const period = resolveSteercoPeriod("custom", pmo, new Date(), { from: "2026-08-20", to: "2026-08-01" });
  expect(() => buildSteercoEvidence(envelope(period), "PMO Lead")).toThrow(/start must be/);
  const snapshot = buildSteercoEvidence(envelope(), "PMO Lead");
  expect(() => assertSteercoSourcesCurrent(snapshot, { ...pmo, revision: 13 }, [buildCorePmoSummary(pmo)])).toThrow(/Source drift/);
});

test("audits accountable overrides and rejection", () => {
  const snapshot = buildSteercoEvidence(envelope(), "PMO Lead");
  const overridden = applySteercoRagOverride(snapshot, "amber", "Programme Lead", "Fresh delivery evidence is pending.");
  expect(overridden.rag.effective).toBe("amber");
  expect(overridden.audit.at(-1)?.event).toBe("steerco.rag_overridden");
  expect(rejectSteercoDraft(snapshot, "Sponsor", "Narrative requires stronger evidence.").status).toBe("rejected");
});
