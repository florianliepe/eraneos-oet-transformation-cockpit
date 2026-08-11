import { expect, test } from "@playwright/test";
import { ProposalSetSchema, buildReviewBundle } from "../src/lib/governed-proposals";

const proposalSet = ProposalSetSchema.parse({
  contractVersion: "proposal-set-1.0",
  id: "PS-agent-test",
  sourceExecutionId: "agent:test",
  correlationId: "correlation:test",
  sourceRevision: 4,
  status: "pending_review",
  createdAt: "2026-08-11T11:00:00.000Z",
  evidence: [{ id: "EVD-1", label: "Status note", verified: true }],
  proposals: [{ id: "PROP-1", sourceExecutionId: "agent:test", workflowId: "risk.analyse", entity: "risk", action: "update", objectId: "R-1", expectedObjectVersion: 2, summary: "Increase risk impact", risk: "high", evidenceIds: ["EVD-1"], fieldChanges: [{ field: "impact", before: 3, after: 5 }], proposedObject: { id: "R-1", impact: 5 } }],
  audit: [{ id: "PAUD-1", event: "proposal.generated", actor: "PMO Orchestrator", at: "2026-08-11T11:00:00.000Z", sourceExecutionId: "agent:test" }],
});

test("builds an immutable review decision linked to source execution and object version", () => {
  const review = buildReviewBundle(proposalSet, "Programme Sponsor", [{ proposalId: "PROP-1", decision: "accept", rationale: "Evidence confirms material impact on the governed milestone." }], "2026-08-11T11:05:00.000Z");
  expect(review.sourceExecutionId).toBe("agent:test");
  expect(review.decisions[0]).toMatchObject({ proposalId: "PROP-1", expectedObjectVersion: 2, decision: "accept" });
});

test("requires accountable rationale for high-impact acceptance or rejection", () => {
  expect(() => buildReviewBundle(proposalSet, "Sponsor", [{ proposalId: "PROP-1", decision: "reject", rationale: "No" }])).toThrow(/at least 20 characters/);
});
