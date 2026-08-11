import { expect, test } from "@playwright/test";
import { buildPortfolioCommandCentre, defaultPortfolioFilters, type PortfolioProjectSource } from "../src/lib/portfolio-command-centre";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import type { ProjectWorkspace } from "../src/lib/workspace-schema";

function workspace(id: string, organisationId: string, name: string): ProjectWorkspace {
  return { contractVersion: "workspace-identity-1.0", id, organisationId, name, status: "active", canonicalDocumentRef: `local://${organisationId}/projects/${id}/pmo`, createdByUserId: "usr_owner001", createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-10T09:00:00.000Z" };
}

test("aggregates two scoped projects with traceable dependencies and capacity", () => {
  const alpha = workspace("prj_alpha001", "org_allowed01", "Alpha"); const beta = workspace("prj_beta0001", "org_allowed01", "Beta");
  const alphaDocument = structuredClone(bootstrapPmoData); alphaDocument.project.id = alpha.id; alphaDocument.project.name = alpha.name; alphaDocument.dependencies[0].relatedObjects.push({ type: "project", id: beta.id });
  const betaDocument = structuredClone(bootstrapPmoData); betaDocument.project.id = beta.id; betaDocument.project.name = beta.name; betaDocument.project.overallRag = "red"; betaDocument.issues.push({ ...structuredClone(betaDocument.issues[0]), id: "ISS-BETA" });
  const sources: PortfolioProjectSource[] = [{ workspace: alpha, dataState: "stored", document: alphaDocument, incidents: [] }, { workspace: beta, dataState: "stored", document: betaDocument, incidents: [] }];
  const result = buildPortfolioCommandCentre("org_allowed01", sources, { ...defaultPortfolioFilters, period: "all" }, new Date("2026-08-11T10:00:00.000Z"));
  expect(result.summaries.map((item) => item.project.name)).toEqual(["Alpha", "Beta"]);
  expect(result.totals.issues).toBe(3); expect(result.dependencies[0]).toMatchObject({ sourceProjectId: alpha.id, targetProjectId: beta.id, id: "DEP-1" });
  expect(result.capacityConstraints).toHaveLength(2); expect(result.summaries[0].signals.issues.source).toContain("governed issue records");
});

test("rejects cross-organisation sources and keeps missing data explicit", () => {
  const allowed = workspace("prj_allowed01", "org_allowed01", "Allowed"); const foreign = workspace("prj_foreign01", "org_foreign01", "Foreign");
  expect(() => buildPortfolioCommandCentre("org_allowed01", [{ workspace: allowed, dataState: "missing", incidents: [] }, { workspace: foreign, dataState: "missing", incidents: [] }], defaultPortfolioFilters)).toThrow(/outside the authorised organisation/);
  const result = buildPortfolioCommandCentre("org_allowed01", [{ workspace: allowed, dataState: "missing", incidents: [] }], defaultPortfolioFilters, new Date("2026-08-11T10:00:00.000Z"));
  expect(result).toMatchObject({ missingProjects: 1, totals: { milestones: 0, risks: 0, issues: 0, decisions: 0, actions: 0, reviews: 0, incidents: 0 } });
});

test("applies owner and attention filters deterministically", () => {
  const alpha = workspace("prj_alpha001", "org_allowed01", "Alpha"); const beta = workspace("prj_beta0001", "org_allowed01", "Beta");
  const alphaDocument = structuredClone(bootstrapPmoData); alphaDocument.project.id = alpha.id; alphaDocument.project.overallRag = "red";
  const betaDocument = structuredClone(bootstrapPmoData); betaDocument.project.id = beta.id; betaDocument.workstreams[0].owner = "Different Owner"; betaDocument.milestones[0].owner = "Different Owner"; betaDocument.risks[0].owner = "Different Owner"; betaDocument.issues[0].owner = "Different Owner"; betaDocument.actions[0].owner = "Different Owner"; betaDocument.decisions[0].owner = "Different Owner";
  const sources: PortfolioProjectSource[] = [{ workspace: alpha, dataState: "stored", document: alphaDocument, incidents: [] }, { workspace: beta, dataState: "stored", document: betaDocument, incidents: [] }];
  expect(buildPortfolioCommandCentre("org_allowed01", sources, { ...defaultPortfolioFilters, owner: "Different Owner" }, new Date("2026-08-11T10:00:00.000Z")).summaries.map((item) => item.project.name)).toEqual(["Beta"]);
  expect(buildPortfolioCommandCentre("org_allowed01", sources, { ...defaultPortfolioFilters, attention: "critical" }, new Date("2026-08-11T10:00:00.000Z")).summaries.some((item) => item.project.name === "Alpha")).toBe(true);
});
