import { expect, test } from "@playwright/test";
import {
  AgentRunReceiptSchema,
  assertAgentRunReceiptIdentity,
  buildPendingAgentRun,
  failedReceiptAgentRun,
  isTerminalAgentRunReceipt,
  outcomeUnknownAgentRun,
} from "../src/lib/agent-run-reconciliation";
import manifest from "../docs/n8n/agents/manifest.json";

const key = "3e62eae7-b23f-4aab-88e4-c371700a4b20";
const requestedAt = "2026-08-12T10:00:00.000Z";

test("uses one stable correlation, idempotency and execution identity", () => {
  const run = buildPendingAgentRun({
    correlation_id: key,
    idempotency_key: key,
    requested_at: requestedAt,
    agent_workflows: "evidence.verify,risk.analyse",
  });
  expect(run).toMatchObject({
    executionId: `agent:${key}`,
    correlationId: key,
    status: "waiting",
    orchestrator: { workflowVersion: manifest.orchestrator.workflowVersion },
  });
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

test("requires terminal timestamps and exposes terminal-state classification", () => {
  const base = { contractVersion: "agent-run-receipt-1.0", runId: `agent:${key}`, correlationId: key, idempotencyKey: key, organisationId: "org_test01", projectId: "prj_test01", requestedAt, updatedAt: requestedAt };
  expect(AgentRunReceiptSchema.safeParse({ ...base, state: "failed", error: { code: "FAILED", safeMessage: "Failed safely.", retryable: true } }).success).toBe(false);
  const failed = AgentRunReceiptSchema.parse({ ...base, state: "failed", completedAt: requestedAt, error: { code: "FAILED", safeMessage: "Failed safely.", retryable: true } });
  expect(isTerminalAgentRunReceipt(failed)).toBe(true);
  expect(isTerminalAgentRunReceipt(AgentRunReceiptSchema.parse({ ...base, state: "accepted" }))).toBe(false);
});

test("rejects receipt identity or workspace drift during reconciliation", () => {
  const receipt = AgentRunReceiptSchema.parse({ contractVersion: "agent-run-receipt-1.0", runId: `agent:${key}`, correlationId: key, idempotencyKey: key, state: "accepted", organisationId: "org_test01", projectId: "prj_test01", requestedAt, updatedAt: requestedAt });
  expect(() => assertAgentRunReceiptIdentity(receipt, { correlationId: key, idempotencyKey: key, organisationId: "org_test01", projectId: "prj_test01" })).not.toThrow();
  expect(() => assertAgentRunReceiptIdentity(receipt, { correlationId: key, idempotencyKey: key, organisationId: "org_test01", projectId: "prj_other01" })).toThrow(/workspace scope/);
});

test("maps a durable failed receipt without misclassifying it as a request-boundary failure", () => {
  const receipt = AgentRunReceiptSchema.parse({
    contractVersion: "agent-run-receipt-1.0",
    runId: `agent:${key}`,
    correlationId: key,
    idempotencyKey: key,
    state: "failed",
    organisationId: "org_test01",
    projectId: "prj_test01",
    requestedAt,
    updatedAt: "2026-08-12T10:00:05.000Z",
    completedAt: "2026-08-12T10:00:05.000Z",
    error: { code: "MODEL_PARAMETER_REJECTED", safeMessage: "The model rejected the controlled request.", retryable: true },
  });
  const run = failedReceiptAgentRun({
    agent_workflows: "evidence.verify,risk.analyse",
    routing: "auto",
    routing_policy: "lean-routing-2.0.0",
  }, receipt);
  expect(run).toMatchObject({
    executionId: `agent:${key}`,
    status: "failed",
    orchestrator: { workflowVersion: "2.0.0", model: "claude-sonnet-5" },
    operations: { latencyMs: 5000 },
    warnings: [{ code: "MODEL_PARAMETER_REJECTED" }],
  });
  expect(run.steps[0]).toMatchObject({ workflowId: "evidence.verify", status: "failed" });
  expect(run.steps[1]).toMatchObject({ workflowId: "risk.analyse", status: "skipped" });
});
