import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { buildCorePmoSummary } from "../src/lib/reporting-schema";
import {
  applySteercoApproval,
  applySteercoRagOverride,
  assertSteercoSourcesCurrent,
  buildSteercoEnvelope,
  buildSteercoEvidence,
  compareSteercoPeriods,
  rejectSteercoDraft,
  resolveSteercoPeriod,
  SteercoSnapshotSchema,
} from "../src/lib/steerco-schema";
import { buildSteercoPowerPoint } from "../src/lib/steerco-export";
import { appendPublicationReceipt, assertExecutiveReportPublishable, buildExecutiveReportPackage, buildPortfolioDecisionPack, recordExecutiveReview, reportSourceFingerprint } from "../src/lib/executive-reporting";
import JSZip from "jszip";

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

test("builds configurable executive modules with benefits, finances, scenarios and explainable trends", () => {
  const snapshot = buildSteercoEvidence(envelope(), "PMO Lead", ["benefits", "finances", "scenarios"]);
  expect(snapshot.reporting.modules).toEqual(["benefits", "finances", "scenarios"]);
  expect(snapshot.sections.benefits[0].sourceIds).toContain("BEN-1");
  expect(snapshot.sections.finances[0].sourceIds).toContain("FIN-1");
  expect(snapshot.sections.scenarios.map((item) => item.id)).toContain("SCN-2");
  expect(snapshot.reporting.trends.find((item) => item.id === "cost-variance")?.explanation).toContain("baseline");
  expect(snapshot.reporting.materialChanges.every((item) => item.sourceIds.length > 0)).toBe(true);
});

test("compares governed periods without mutating either immutable input", () => {
  const previous = buildSteercoEvidence(envelope(), "PMO Lead");
  const current = structuredClone(previous);
  current.id = "STEERCO-CURRENT";
  current.reporting.trends[0].current += 5;
  const compared = compareSteercoPeriods(current, previous);
  expect(compared.reporting.trends[0]).toMatchObject({ previous: previous.reporting.trends[0].current, direction: "improving" });
  expect(previous.reporting.trends[0].previous).toBeUndefined();
});

test("binds project reporting to scope, assigned review and immutable publication receipts", () => {
  const draft = buildSteercoEvidence(envelope(), "PMO Lead");
  const supported = { ...draft, executiveSummary: [{ id: "AI-1", text: "Critical delivery evidence requires a decision.", kind: "ai_narrative" as const, sourceIds: ["R-1", "DEL-1"] }] };
  const approved = applySteercoApproval(supported, "Programme Sponsor", "Reviewed cited evidence.");
  const assigned = buildExecutiveReportPackage({ snapshot: approved, scope: { organisationId: "org_test01", targetKind: "project", targetIds: ["prj_test01"] }, reviewer: "Programme Sponsor", decisionRequests: [{ id: "REQ-1", title: "Confirm recovery tolerance", owner: "Programme Sponsor", dueDate: "2026-08-31", status: "requested", sourceIds: ["R-1"] }] });
  expect(() => recordExecutiveReview(assigned, "Another reviewer", "approved", "Reviewed.")).toThrow(/assigned reviewer/);
  const reviewed = recordExecutiveReview(assigned, "Programme Sponsor", "approved", "Reviewed evidence and decision request.", "2026-08-11T12:00:00.000Z");
  expect(assertExecutiveReportPublishable(reviewed, approved)).toBe(true);
  expect(() => assertExecutiveReportPublishable(reviewed, { ...approved, sourceRevision: { ...approved.sourceRevision, pmo: approved.sourceRevision.pmo + 1 } })).toThrow(/sources changed/);
  const published = appendPublicationReceipt(appendPublicationReceipt(reviewed, "approved", "Programme Sponsor", "Approved.", "2026-08-11T12:01:00.000Z"), "published", "Programme Sponsor", undefined, "2026-08-11T12:02:00.000Z");
  expect(published.publicationHistory[1]).toMatchObject({ action: "published", previousReceiptId: published.publicationHistory[0].id });
  expect(() => appendPublicationReceipt(reviewed, "published", "Programme Sponsor", undefined, "2026-08-11T12:02:00.000Z")).toThrow(/transition none -> published/);
  expect(() => appendPublicationReceipt(published, "restored", "Programme Sponsor", "Restore.", "2026-08-11T12:03:00.000Z")).toThrow(/transition published -> restored/);
  expect(() => appendPublicationReceipt(published, "revoked", "Programme Sponsor", "", "2026-08-11T12:03:00.000Z")).toThrow(/rationale is required/);
  const revoked = appendPublicationReceipt(published, "revoked", "Programme Sponsor", "Superseded by a corrected pack.", "2026-08-11T12:03:00.000Z");
  const restored = appendPublicationReceipt(revoked, "restored", "Programme Sponsor", "Correction verified.", "2026-08-11T12:04:00.000Z");
  expect(restored.publicationHistory.map((receipt) => receipt.action)).toEqual(["approved", "published", "revoked", "restored"]);
  expect(() => appendPublicationReceipt(restored, "revoked", "Programme Sponsor", "Late receipt.", "2026-08-11T12:03:30.000Z")).toThrow(/chronological order/);
});

test("builds a portfolio pack only from approved snapshots and keeps missing projects explicit", () => {
  const draft = buildSteercoEvidence(envelope(), "PMO Lead");
  const supported = { ...draft, executiveSummary: [{ id: "AI-1", text: "Portfolio attention is required.", kind: "ai_narrative" as const, sourceIds: ["R-1"] }] };
  const approved = applySteercoApproval(supported, "Sponsor", "Reviewed sources.");
  const pack = buildPortfolioDecisionPack("org_test01", [{ projectId: "prj_test01", snapshot: approved }, { projectId: "prj_test02" }], "2026-08-11T12:00:00.000Z");
  expect(pack.projects).toHaveLength(1);
  expect(pack.attention[0]).toMatchObject({ projectId: "prj_test01" });
  expect(pack.missing).toEqual(["prj_test02: no approved snapshot supplied."]);
  expect(pack.projects[0].sourceFingerprint).toBe(reportSourceFingerprint(approved));
  expect(() => buildPortfolioDecisionPack("org_test01", [{ projectId: "prj_test01", snapshot: approved }, { projectId: "prj_test01", snapshot: approved }])).toThrow(/exactly once/);
  expect(() => buildExecutiveReportPackage({ snapshot: approved, scope: { organisationId: "org_test01", targetKind: "portfolio", targetIds: ["prj_test01", "prj_test01"] }, reviewer: "Sponsor" })).toThrow(/unique/);
});

test("blocks unsupported material claims and creates a reproducible PowerPoint package after review", async () => {
  const draft = buildSteercoEvidence(envelope(), "PMO Lead");
  const unsupported = { ...draft, executiveSummary: [{ id: "J-1", text: "Leadership believes adoption will accelerate.", kind: "human_override" as const, sourceIds: [] }] };
  expect(() => applySteercoApproval(unsupported, "Sponsor", "Reviewed.")).toThrow(/material claim/);
  const supported = { ...unsupported, executiveSummary: [{ ...unsupported.executiveSummary[0], judgementBasis: "Sponsor judgement based on the agreed change approach." }] };
  const approved = applySteercoApproval(supported, "Sponsor", "Reviewed evidence and judgement labels.");
  const bytes = await buildSteercoPowerPoint(approved);
  const zip = await JSZip.loadAsync(bytes);
  expect(zip.file("ppt/presentation.xml")).not.toBeNull();
  const evidenceSlide = await zip.file("ppt/slides/slide5.xml")?.async("string");
  expect(evidenceSlide).toContain("Source PMO revision");
  expect(evidenceSlide).toContain("Sponsor");
  const manifest = JSON.parse(await zip.file("_provenance/report-manifest.json")!.async("string"));
  expect(manifest).toMatchObject({ contractVersion: "executive-report-export-1.0", snapshotId: approved.id, sourceFingerprint: reportSourceFingerprint(approved) });
});
