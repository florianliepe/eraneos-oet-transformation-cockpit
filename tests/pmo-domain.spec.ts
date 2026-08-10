import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { PmoDocumentSchema, migratePmoDocument } from "../src/lib/pmo-schema";
import { upsertPmoRecord, validatePmoReferences } from "../src/lib/pmo-domain";

test("exposes every first-class PMO register and governance contract", () => {
  const document = PmoDocumentSchema.parse(structuredClone(bootstrapPmoData));
  for (const collection of ["issues", "actions", "decisions", "dependencies", "assumptions", "changeRequests"] as const) {
    expect(document[collection].length, `${collection} fixture`).toBeGreaterThan(0);
    expect(document[collection][0].governance.version).toBeGreaterThan(0);
  }
  expect(document.evidence.length).toBeGreaterThan(0);
  expect(document.reviews.length).toBeGreaterThan(0);
  expect(document.audit.length).toBeGreaterThan(0);
  expect(document.objectVersions.length).toBeGreaterThan(0);
  expect(validatePmoReferences(document)).toEqual([]);
});

test("migrates embedded legacy meeting decisions and actions", () => {
  const legacy = {
    schemaVersion: "1.0", revision: 3,
    project: { id: "P-1", name: "Transformation", subtitle: "Programme", phase: "Mobilise", startDate: "2026-01-01", endDate: "2026-12-31", overallRag: "amber", progress: 20, updatedAt: "2026-08-10T10:00:00.000Z" },
    workstreams: [], milestones: [], deliverables: [], risks: [],
    meetings: [{ id: "MTG-1", title: "Steering", date: "2026-08-10", type: "steering", participants: ["Sponsor"], summary: "Review", decisions: ["Proceed."], actions: [{ text: "Publish plan", owner: "PMO", dueDate: "2026-08-15" }] }],
    activity: [{ id: "LEG-1", timestamp: "2026-08-10T10:00:00.000Z", actor: "Migration", message: "Legacy event" }],
  };
  const migrated = migratePmoDocument(legacy);
  expect(migrated.schemaVersion).toBe("2.0");
  expect(migrated.decisions).toHaveLength(1);
  expect(migrated.actions).toHaveLength(1);
  expect(migrated.meetings[0].decisionIds).toEqual([migrated.decisions[0].id]);
  expect(migrated.meetings[0].actionIds).toEqual([migrated.actions[0].id]);
  expect(migrated.audit[0].action).toBe("migrate");
});

test("versions and audits PMO object changes", () => {
  const document = structuredClone(bootstrapPmoData);
  const current = document.issues[0];
  const updated = upsertPmoRecord(document, "issue", { ...current, status: "in_progress" }, "PMO Lead", "2026-08-10T12:00:00.000Z", current.governance.evidenceIds);
  expect(updated.issues[0].governance.version).toBe(current.governance.version + 1);
  expect(updated.audit[0]).toMatchObject({ action: "update", actor: "PMO Lead", object: { type: "issue", id: current.id } });
  expect(updated.objectVersions[0]).toMatchObject({ object: { type: "issue", id: current.id }, version: current.governance.version + 1 });
});

test("reports broken cross-object references", () => {
  const document = structuredClone(bootstrapPmoData);
  document.meetings[0].actionIds.push("ACTN-MISSING");
  expect(validatePmoReferences(document)).toContain(`${document.meetings[0].id} references missing action ACTN-MISSING.`);
});
