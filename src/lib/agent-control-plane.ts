import { z } from "zod";
import manifest from "../../docs/n8n/agents/manifest.json";
import release from "../../docs/n8n/releases/2026-08-12-zm-prod-18.json";
import { SPECIALIST_AGENTS, type AgentRunEnvelope } from "@/lib/agent-contracts";
import type { AgentOperationRecord } from "@/lib/agent-operations";

export const AGENT_CONTROL_PLANE_VERSION = "agent-control-plane-1.0" as const;

export const AgentCatalogueEntrySchema = z.object({
  contractVersion: z.literal(AGENT_CONTROL_PLANE_VERSION),
  workflowId: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  workflowVersion: z.string().min(1),
  releaseId: z.string().min(1),
  liveBindingId: z.string().min(1),
  dataClassification: z.enum(["project_confidential", "operational_metadata"]),
  availability: z.enum(["release_verified", "unverified"]),
  writeBoundary: z.enum(["proposal_only", "reviewed_canonical_write", "operational_only"]),
});

export type AgentCatalogueEntry = z.infer<typeof AgentCatalogueEntrySchema>;

export function diagnoseWorkflowCompatibility(entry: AgentCatalogueEntry, runtime: { releaseId?: string; liveBindingId?: string }) {
  if (!runtime.releaseId || !runtime.liveBindingId) return { status: "unknown" as const, guidance: "Run the checked-in release verifier and request runtime metadata from the workflow operator." };
  if (runtime.releaseId !== entry.releaseId || runtime.liveBindingId !== entry.liveBindingId) return { status: "stale_binding" as const, guidance: "Stop publication, compare the release manifest and live binding, then restore the last verified release." };
  return { status: "compatible" as const, guidance: "Release and live binding match the signed catalogue." };
}

export const AGENT_CATALOGUE: AgentCatalogueEntry[] = [
  {
    workflowId: manifest.orchestrator.workflowId, title: "PMO orchestrator",
    purpose: "Validates the scoped request and selects the smallest justified specialist route.",
    workflowVersion: manifest.orchestrator.workflowVersion, liveBindingId: manifest.orchestrator.liveWorkflowId,
    dataClassification: "project_confidential" as const, writeBoundary: "proposal_only" as const,
  },
  ...manifest.workflows.map((workflow) => {
    const specialist = SPECIALIST_AGENTS.find((item) => item.workflow === workflow.workflowId);
    return {
      workflowId: workflow.workflowId, title: workflow.title, purpose: specialist?.copy || "Specialist PMO analysis.",
      workflowVersion: workflow.workflowVersion, liveBindingId: workflow.liveWorkflowId,
      dataClassification: "project_confidential" as const, writeBoundary: "proposal_only" as const,
    };
  }),
  {
    workflowId: manifest.publisher.workflowId, title: "Governed publisher",
    purpose: "Writes accepted, version-checked proposals after accountable human review.",
    workflowVersion: manifest.publisher.workflowVersion, liveBindingId: manifest.publisher.liveWorkflowId,
    dataClassification: "project_confidential" as const, writeBoundary: "reviewed_canonical_write" as const,
  },
  {
    workflowId: "operations.error", title: "Central error handler",
    purpose: "Captures redacted failure metadata for bounded recovery and operator escalation.",
    workflowVersion: manifest.operations.contractVersion, liveBindingId: manifest.operations.errorWorkflowLiveId,
    dataClassification: "operational_metadata" as const, writeBoundary: "operational_only" as const,
  },
].map((entry) => AgentCatalogueEntrySchema.parse({
  contractVersion: AGENT_CONTROL_PLANE_VERSION,
  releaseId: release.releaseId,
  availability: "release_verified",
  ...entry,
}));

export function runProgress(run: AgentRunEnvelope) {
  const completed = run.steps.filter((step) => ["completed", "needs_review", "skipped"].includes(step.status)).length;
  const percent = run.steps.length ? Math.round((completed / run.steps.length) * 100) : 0;
  const latencyMs = run.operations.latencyMs ?? (run.completedAt ? Math.max(0, new Date(run.completedAt).getTime() - new Date(run.requestedAt).getTime()) : undefined);
  const timeoutMs = run.routing.budget?.maxLatencyMs;
  return {
    completed, total: run.steps.length, percent,
    latencyMs,
    timeoutState: timeoutMs && latencyMs && latencyMs > timeoutMs ? "budget_exceeded" as const : run.status === "running" || run.status === "waiting" ? "monitoring" as const : "within_budget" as const,
  };
}

export function runEscalations(run: AgentRunEnvelope) {
  const reasons = [
    ...(run.status === "needs_review" ? ["Run requires accountable human review."] : []),
    ...(run.routing.budget?.limited ? ["Routing was limited by the declared budget."] : []),
    ...run.steps.filter((step) => step.confidence === "low").map((step) => `${step.workflowId} reported low confidence.`),
    ...run.warnings.filter((warning) => /conflict|policy|review/i.test(`${warning.code} ${warning.message}`)).map((warning) => warning.message),
  ];
  return [...new Set(reasons)];
}

export function classifyDuplicates(records: AgentOperationRecord[]) {
  const firstByKey = new Map<string, string>();
  return records.map((record) => {
    const prior = firstByKey.get(record.idempotency.key);
    if (!prior) firstByKey.set(record.idempotency.key, record.executionId);
    return { executionId: record.executionId, duplicateOf: record.idempotency.duplicateOf || prior };
  });
}

export function assertScopedCanonicalWrite(input: { record: AgentOperationRecord; organisationId: string; projectId: string; reviewOutcome: AgentRunEnvelope["operations"]["reviewOutcome"] }) {
  if (input.record.scope.organisationId !== input.organisationId || input.record.scope.projectId !== input.projectId) throw new Error("Agent run scope does not match the canonical project boundary.");
  if (!["accepted", "mixed"].includes(input.reviewOutcome)) throw new Error("Canonical publication requires an accountable accepted review outcome.");
  return true;
}
