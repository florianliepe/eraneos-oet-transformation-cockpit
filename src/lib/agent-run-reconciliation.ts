import { z } from "zod";
import manifest from "../../docs/n8n/agents/manifest.json";
import { AgentWorkflowIdSchema, AgentRunEnvelopeSchema, selectedAgentWorkflows, type AgentRunEnvelope } from "@/lib/agent-contracts";

export const AGENT_RUN_RECEIPT_VERSION = "agent-run-receipt-1.0" as const;

export const AgentRunReceiptSchema = z.object({
  contractVersion: z.literal(AGENT_RUN_RECEIPT_VERSION),
  runId: z.string().regex(/^agent:[A-Za-z0-9-]{8,80}$/),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/),
  state: z.enum(["accepted", "running", "completed", "failed"]),
  organisationId: z.string().min(8),
  projectId: z.string().min(8),
  requestedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.string().min(1), safeMessage: z.string().min(1), retryable: z.boolean() }).optional(),
}).superRefine((receipt, context) => {
  if (receipt.state === "completed" && receipt.result === undefined) context.addIssue({ code: "custom", message: "Completed run receipt requires a result." });
  if (receipt.state === "failed" && !receipt.error) context.addIssue({ code: "custom", message: "Failed run receipt requires a safe error." });
});

export type AgentRunReceipt = z.infer<typeof AgentRunReceiptSchema>;

export class AgentOutcomeUnknownError extends Error {
  readonly receipt: AgentRunReceipt;
  constructor(receipt: AgentRunReceipt) {
    super(`The run outcome is not yet confirmed. Reconcile run ${receipt.runId} before retrying.`);
    this.name = "AgentOutcomeUnknownError";
    this.receipt = receipt;
  }
}

export const AgentRunAcceptedResponseSchema = z.object({ ok: z.literal(true), accepted: z.literal(true), run: AgentRunReceiptSchema });
export const AgentRunStatusResponseSchema = z.object({ ok: z.literal(true), run: AgentRunReceiptSchema });

export function buildPendingAgentRun(meta: Record<string, string>, state: "waiting" | "running" = "waiting"): AgentRunEnvelope {
  const correlationId = z.string().uuid().parse(meta.correlation_id);
  const idempotencyKey = z.string().min(8).parse(meta.idempotency_key);
  const requestedAt = z.string().datetime().parse(meta.requested_at);
  const workflows = selectedAgentWorkflows(meta.agent_workflows);
  return AgentRunEnvelopeSchema.parse({
    contractVersion: "agent-run-1.0",
    executionId: `agent:${idempotencyKey}`,
    correlationId,
    status: state,
    requestedAt,
    orchestrator: { workflowId: "pmo.orchestrate", workflowVersion: manifest.orchestrator.workflowVersion },
    routing: {
      mode: meta.routing || "smart_auto",
      selectedWorkflows: workflows,
      policyVersion: meta.routing_policy || "smart-routing-1.2.0",
      explanation: parseRoutingExplanation(meta.routing_explanation),
    },
    steps: workflows.map((workflowId) => ({
      workflowId: AgentWorkflowIdSchema.parse(workflowId), workflowVersion: "release-bound", status: state === "running" ? "running" : "queued",
      summary: state === "running" ? "The accepted n8n run is processing and will be reconciled by its receipt." : "The request is being accepted by the governed n8n boundary.",
      confidence: "not_assessed", evidenceIds: [], proposalIds: [],
    })),
    evidence: [], proposals: [], warnings: [], persistence: { mode: "proposal_only" },
    operations: { attempt: Number(meta.recovery_attempt || 1), reviewOutcome: "pending" },
  });
}

export function outcomeUnknownAgentRun(run: AgentRunEnvelope, reason: string): AgentRunEnvelope {
  return AgentRunEnvelopeSchema.parse({
    ...run,
    status: "waiting",
    steps: run.steps.map((step) => step.status === "completed" ? step : { ...step, status: "queued", summary: "Outcome not yet confirmed; backend processing may still be active." }),
    warnings: [...run.warnings, { code: "OUTCOME_UNKNOWN", message: reason, evidenceIds: [] }],
  });
}

function parseRoutingExplanation(value: string | undefined) {
  try {
    return z.array(z.object({ workflowId: AgentWorkflowIdSchema, reason: z.string(), sequence: z.number().int().positive() })).parse(JSON.parse(value || "[]"));
  } catch { return []; }
}
