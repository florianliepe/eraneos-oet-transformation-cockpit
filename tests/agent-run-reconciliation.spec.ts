import { expect, test } from "@playwright/test";
import {
  AgentRunReceiptSchema,
  buildPendingAgentRun,
  outcomeUnknownAgentRun,
} from "../src/lib/agent-run-reconciliation";

const key = "3e62eae7-b23f-4aab-88e4-c371700a4b20";
const requestedAt = "2026-08-12T10:00:00.000Z";

test("uses one stable correlation, idempotency and execution identity", () => {
  const run = buildPendingAgentRun({
    correlation_id: key,
    idempotency_key: key,
    requested_at: requestedAt,
    agent_workflows: "evidence.verify,risk.analyse",
  });
  expect(run).toMatchObject({ executionId: `agent:${key}`, correlationId: key, status: "waiting" });
  expect(run.steps.every((step) => step.status === "queued")).toBe(true);
});

test("represents an unconfirmed request boundary as waiting without specialist blame", () => {
  const pending = buildPendingAgentRun({ correlation_id: key, idempotency_key: key, requested_at: requestedAt, agent_workflows: "evidence.verify,risk.analyse" }, "running");
  const unknown = outcomeUnknownAgentRun(pending, "Status polling was interrupted.");
  expect(unknown.status).toBe("waiting");
  expect(unknown.warnings).toContainEqual(expect.objectContaining({ code: "OUTCOME_UNKNOWN" }));
  expect(unknown.steps.some((step) => step.status === "failed")).toBe(false);
});

test("requires completed receipts to contain a result", () => {
  const receipt = { contractVersion: "agent-run-receipt-1.0", runId: `agent:${key}`, correlationId: key, idempotencyKey: key, state: "completed", organisationId: "org_test01", projectId: "prj_test01", requestedAt, updatedAt: requestedAt, completedAt: requestedAt };
  expect(AgentRunReceiptSchema.safeParse(receipt).success).toBe(false);
  expect(AgentRunReceiptSchema.parse({ ...receipt, result: { ok: true } }).state).toBe("completed");
});
