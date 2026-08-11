import { expect, test } from "@playwright/test";
import { applyBulkUpdate, applyImportPreview, deliveryRelationships, deliveryTimeline, exportRegisterCsv, filterAndSortDeliveryRecords, onboardingChecklist, previewBulkUpdate, previewCsvImport } from "../src/lib/project-delivery-workbench";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

test("filters and sorts governed registers deterministically", () => {
  const view = { register: "issue" as const, query: "baseline", owner: "PMO Lead", status: "in_progress", sort: "version" as const, direction: "desc" as const };
  expect(filterAndSortDeliveryRecords(bootstrapPmoData, view).map((item) => item.id)).toEqual(["ISS-1"]);
  expect(filterAndSortDeliveryRecords(bootstrapPmoData, { ...view, owner: "Different owner" })).toEqual([]);
});

test("previews version-checked bulk updates and preserves audit lineage", () => {
  const document = structuredClone(bootstrapPmoData); const preview = previewBulkUpdate(document, "issue", ["ISS-1"], { owner: "Delivery Lead", status: "resolved" });
  const next = applyBulkUpdate(document, preview, "PMO Lead", "2026-08-11T20:00:00.000Z");
  expect(next.issues[0]).toMatchObject({ owner: "Delivery Lead", status: "resolved", governance: { version: 2 } }); expect(next.audit[0]).toMatchObject({ action: "update", object: { type: "issue", id: "ISS-1" } }); expect(next.objectVersions[0].version).toBe(2);
  const stale = structuredClone(document); stale.issues[0].governance.version = 2; expect(() => applyBulkUpdate(stale, preview, "PMO Lead")).toThrow(/stale version/);
});

test("previews and applies controlled CSV updates without bypassing versions", () => {
  const csv = exportRegisterCsv(bootstrapPmoData, "issue").replace("PMO Lead", "Delivery Owner").replace("in_progress", "resolved"); const preview = previewCsvImport("issue", csv);
  expect(preview.errors).toEqual([]); const next = applyImportPreview(structuredClone(bootstrapPmoData), preview, "PMO Lead", "2026-08-11T20:05:00.000Z");
  expect(next.issues[0]).toMatchObject({ owner: "Delivery Owner", status: "resolved", governance: { version: 2 } }); expect(next.audit[0].action).toBe("import");
  const stale = previewCsvImport("issue", csv.replace(',"1","not_requested"', ',"99","not_requested"')); expect(() => applyImportPreview(structuredClone(bootstrapPmoData), stale, "PMO Lead")).toThrow(/stale object version/);
});

test("derives onboarding, relationships and the explainable milestone timeline", () => {
  expect(onboardingChecklist(bootstrapPmoData).filter((item) => item.complete).length).toBeGreaterThanOrEqual(4); expect(deliveryRelationships(bootstrapPmoData)).toEqual(expect.arrayContaining([expect.objectContaining({ relation: "realises" })]));
  const timeline = deliveryTimeline(bootstrapPmoData); expect(timeline.milestones[0].id).toBe("M-1"); expect(timeline.explanation).toContain("deliverable:DEL-1");
});
