import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { PmoDocumentSchema } from "../src/lib/pmo-schema";
import { calculateCriticalPath, compareScenarios, programmeMetrics, validateProgrammeDecisionSupport } from "../src/lib/programme-decision-support";

test("validates governed portfolio objects and deterministic variance calculations", () => {
  const document = PmoDocumentSchema.parse(bootstrapPmoData);
  const collections = [document.portfolios, document.programmes, document.outcomes, document.benefits, document.resourcePools, document.financials, document.scenarios];
  for (const record of collections.flat()) {
    expect(record.governance.evidenceIds).toContain("EVD-PORTFOLIO");
    expect(record.governance.reviewIds.length).toBeGreaterThan(0);
    expect(document.audit.some((item) => item.object.id === record.id)).toBeTruthy();
    expect(document.objectVersions.some((item) => item.object.id === record.id)).toBeTruthy();
  }
  expect(validateProgrammeDecisionSupport(document)).toEqual([]);
  expect(programmeMetrics(document)).toMatchObject({ costVariance: 120000, benefitGap: -80000, capacityGap: -2.5 });
});

test("calculates an explainable critical path and rejects cycles", () => {
  const path = calculateCriticalPath(bootstrapPmoData);
  expect(path.nodes).toEqual(["deliverable:DEL-1", "milestone:M-1"]);
  expect(path.totalLagDays).toBe(15);
  expect(path.assumptions[0]).toContain("provider → consumer");

  const cycled = PmoDocumentSchema.parse({ ...bootstrapPmoData, dependencies: [...bootstrapPmoData.dependencies, { ...bootstrapPmoData.dependencies[1], id: "DEP-CYCLE", relatedObjects: [{ type: "milestone", id: "M-1" }, { type: "deliverable", id: "DEL-1" }] }] });
  expect(validateProgrammeDecisionSupport(cycled)).toContain("Dependency network contains a cycle; critical path is not defensible.");
});

test("compares scenarios without mutating the approved baseline", () => {
  const baseline = structuredClone(bootstrapPmoData.scenarios[0]);
  const candidate = bootstrapPmoData.scenarios[1];
  expect(compareScenarios(baseline, candidate)).toMatchObject({ scheduleDeltaDays: -14, costDelta: 80000, benefitDelta: 110000, baselineImmutable: true, reviewRequired: true });
  expect(bootstrapPmoData.scenarios[0]).toEqual(baseline);

  const broken = PmoDocumentSchema.parse({ ...bootstrapPmoData, programmes: [{ ...bootstrapPmoData.programmes[0], portfolioId: "PORT-MISSING" }] });
  expect(validateProgrammeDecisionSupport(broken).some((error) => error.includes("missing portfolio PORT-MISSING"))).toBeTruthy();
});
