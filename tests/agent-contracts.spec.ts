import { expect, test } from "@playwright/test";
import { AgentRunEnvelopeSchema, legacyAgentRun, selectedAgentWorkflows } from "../src/lib/agent-contracts";

test("normalizes a legacy orchestrator result without overstating specialist execution", () => {
  const run = legacyAgentRun({
    meta: {
      wpId: "INTAKE-1",
      correlation_id: "correlation-1",
      requested_at: "2026-08-11T10:00:00.000Z",
      routing: "auto",
      agent_workflows: "evidence.verify,risk.analyse,governance.review",
    },
    evidence: [{ name: "status.md", contentHash: "a".repeat(64) }],
    appliedChanges: [{ entity: "risk", action: "create", id: "R-1", summary: "Decision latency" }],
    needsReview: ["Confirm the accountable owner."],
    revision: 3,
    commitSha: "abc123",
  });

  expect(AgentRunEnvelopeSchema.parse(run)).toEqual(run);
  expect(run.status).toBe("needs_review");
  expect(run.steps).toHaveLength(3);
  expect(run.steps.every((step) => step.status === "requested")).toBeTruthy();
  expect(run.proposals[0]).toMatchObject({ workflowId: "governance.review", entity: "risk", action: "create" });
  expect(run.persistence.mode).toBe("legacy_direct");
  expect(run.warnings.map((warning) => warning.code)).toEqual(["LEGACY_DIRECT_PERSISTENCE", "REVIEW_REQUIRED"]);
});

test("rejects invalid workflow identifiers and invalid run envelopes", () => {
  expect(selectedAgentWorkflows("risk.analyse,unknown.workflow")).toEqual(["risk.analyse"]);
  expect(AgentRunEnvelopeSchema.safeParse({ contractVersion: "agent-run-1.0" }).success).toBeFalsy();
});

