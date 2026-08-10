import { expect, test } from "@playwright/test";
import type { PmoDocument } from "../src/lib/pmo-schema";
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

const pmo: PmoDocument = {
  schemaVersion: "1.0",
  revision: 12,
  project: { id: "TRANSFORM-01", name: "Operating Model Transformation", subtitle: "Governed programme", phase: "Delivery", startDate: "2026-07-01", endDate: "2026-12-31", overallRag: "amber", progress: 62, updatedAt: "2026-08-08T10:00:00.000Z" },
  workstreams: [{ id: "WS-1", name: "Programme delivery", shortName: "Delivery", owner: "PMO", progress: 62, rag: "amber" }],
  milestones: [{ id: "M-1", title: "Design gate", phase: "Delivery", date: "2026-08-20", status: "at_risk", owner: "PMO", description: "Validate the target design." }],
  deliverables: [{ id: "DEL-1", title: "Target operating model", workstream: "WS-1", dueDate: "2026-08-05", status: "blocked", owner: "Workstream Lead", progress: 70, priority: "P1" }],
  risks: [{ id: "R-1", title: "Decision latency", description: "Sponsor decision is pending.", probability: 4, impact: 5, state: "open", owner: "Programme Lead", mitigation: "Pre-wire the decision.", updatedAt: "2026-08-01" }],
  meetings: [{ id: "MTG-SC-1", title: "Steering Committee 7", date: "2026-08-01", type: "steering", participants: ["Sponsor"], summary: "Delivery review", decisions: ["Retain the current delivery sequence."], actions: [{ text: "Confirm design decision", owner: "Programme Lead", dueDate: "2026-08-03" }] }],
  activity: [{ id: "ACT-1", timestamp: "2026-08-08T10:00:00.000Z", type: "automation", actor: "Workflow", message: "Validated governed project data.", entityId: "REV-11" }],
};

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
