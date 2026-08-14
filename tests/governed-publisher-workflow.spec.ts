import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";

type PublisherResult = {
  shouldWrite: boolean;
  duplicate: boolean;
  revision: number;
  acceptedProposalIds: string[];
  rejectedProposalIds: string[];
  document: typeof bootstrapPmoData;
};

const workflow = JSON.parse(readFileSync(resolve("docs/n8n/agents/governed-publisher.workflow.json"), "utf8"));
const validatorCode = workflow.nodes.find((node: { name: string }) => node.name === "ValidateGovernedPublication").parameters.jsCode;
const execute = new Function("$json", validatorCode) as (input: unknown) => Array<{ json: PublisherResult }>;

function input(decision: "accept" | "reject", document = structuredClone(bootstrapPmoData), key = "publish-test-0001") {
  const scope = { organisationId: "org_test01", projectId: "prj_test01" };
  document.project.id = scope.projectId;
  const risk = document.risks[0];
  const sourceExecutionId = "agent:publisher-test";
  const proposalSet = {
    contractVersion: "proposal-set-1.0", scope, id: "PS-agent-publisher-test", sourceExecutionId,
    correlationId: "publisher-test", sourceRevision: document.revision, status: "pending_review",
    createdAt: "2026-08-11T11:00:00.000Z",
    evidence: [{ id: "EVD-PUBLISHER-1", label: "Verified status note", source: "fixture", verified: true }],
    proposals: [{
      id: "PROP-PUBLISHER-1", sourceExecutionId, workflowId: "risk.analyse", entity: "risk", action: "update",
      objectId: risk.id, expectedObjectVersion: risk.governance.version, summary: "Update governed risk exposure", risk: "high",
      evidenceIds: ["EVD-PUBLISHER-1"], fieldChanges: [{ field: "impact", before: risk.impact, after: 5 }],
      proposedObject: { ...risk, impact: 5 },
    }],
  };
  const reviewBundle = {
    contractVersion: "review-decision-1.0", scope, id: "REV-PS-agent-publisher-test-20260811110500",
    proposalSetId: proposalSet.id, sourceExecutionId, reviewer: "Programme Sponsor", decidedAt: "2026-08-11T11:05:00.000Z",
    decisions: [{ proposalId: "PROP-PUBLISHER-1", sourceExecutionId, decision, reviewer: "Programme Sponsor", rationale: "Evidence was reviewed and supports this accountable decision.", decidedAt: "2026-08-11T11:05:00.000Z", expectedObjectVersion: risk.governance.version }],
    audit: [],
  };
  return { authorized: true, scope, canonicalPath: `knowledge/pmo/workspaces/${scope.organisationId}/${scope.projectId}/control-tower.json`, proposalSet, reviewBundle, canonicalDocument: document, expectedRevision: document.revision, idempotencyKey: key, actor: "Programme Sponsor" };
}

test("accepted publication creates one revision with evidence, review, audit and object-version lineage", () => {
  const before = bootstrapPmoData.revision;
  const result = execute(input("accept"))[0].json;
  expect(result.shouldWrite).toBe(true);
  expect(result.revision).toBe(before + 1);
  expect(result.document.evidence[0].id).toBe("EVD-PUBLISHER-1");
  expect(result.document.reviews[0]).toMatchObject({ status: "approved", reviewer: "Programme Sponsor" });
  expect(result.document.objectVersions[0]).toMatchObject({ version: bootstrapPmoData.risks[0].governance.version + 1 });
  expect(result.document.audit.slice(0, 2).map((event) => event.action)).toEqual(["publish", "approve"]);
});

test("rejected publication leaves canonical revision unchanged", () => {
  const result = execute(input("reject"))[0].json;
  expect(result).toMatchObject({ shouldWrite: false, duplicate: false, revision: bootstrapPmoData.revision, acceptedProposalIds: [], rejectedProposalIds: ["PROP-PUBLISHER-1"] });
});

test("duplicate idempotency key cannot create another revision", () => {
  const document = structuredClone(bootstrapPmoData);
  document.audit.unshift({ ...document.audit[0], id: "AUD-PRIOR-PUBLISH", correlationId: "publish:publish-test-0001" });
  const result = execute(input("accept", document))[0].json;
  expect(result).toMatchObject({ shouldWrite: false, duplicate: true, revision: document.revision });
});

test("each retry rereads canonical state and exposes bounded attempt lineage", () => {
  expect(workflow.connections["Called by PMO Orchestrator"].main[0][0].node).toBe("PreparePublisherAttempt");
  expect(workflow.connections.PreparePublisherAttempt.main[0][0].node).toBe("GitHubReadCurrentCanonicalForPublication");
  expect(workflow.connections.GitHubReadCurrentCanonicalForPublication.main[0][0].node).toBe("BuildFreshPublisherInput");
  const prepare = workflow.nodes.find((node: { name: string }) => node.name === "PreparePublisherAttempt");
  expect(prepare.parameters.jsCode).toContain("publisher-retry-1.0");
  expect(prepare.parameters.jsCode).toContain("maxAttempts:2");
});

test("rejects proposal and canonical artifacts from another project scope", () => {
  const crossScope = input("accept") as ReturnType<typeof input> & {
    proposalSet: { scope: { organisationId: string; projectId: string } };
  };
  crossScope.proposalSet.scope = { ...crossScope.proposalSet.scope, projectId: "prj_other01" };
  expect(() => execute(crossScope)).toThrow("Publisher artifacts do not share the authorized workspace scope.");
});
