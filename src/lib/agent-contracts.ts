import { z } from "zod";

export const AGENT_CONTRACT_VERSION = "agent-run-1.0" as const;

export const AgentWorkflowIdSchema = z.enum([
  "evidence.verify",
  "delivery.plan",
  "risk.analyse",
  "meeting.synthesise",
  "controls.classify",
  "governance.review",
]);

export type AgentWorkflowId = z.infer<typeof AgentWorkflowIdSchema>;

export const SPECIALIST_AGENTS: ReadonlyArray<{
  id: string;
  workflow: AgentWorkflowId;
  title: string;
  copy: string;
}> = [
  { id: "evidence", workflow: "evidence.verify", title: "Evidence verifier", copy: "Checks sources, ambiguity and confidence." },
  { id: "delivery", workflow: "delivery.plan", title: "Delivery planner", copy: "Maps commitments to milestones and deliverables." },
  { id: "risk", workflow: "risk.analyse", title: "Risk analyst", copy: "Extracts exposure, scoring and mitigations." },
  { id: "meeting", workflow: "meeting.synthesise", title: "Meeting synthesizer", copy: "Separates summaries, decisions and actions." },
  { id: "controls", workflow: "controls.classify", title: "PMO controls analyst", copy: "Classifies issues, actions, dependencies, assumptions and changes." },
  { id: "governance", workflow: "governance.review", title: "Governance reviewer", copy: "Links evidence, reviews and audit-ready object versions." },
];

export const AgentConfidenceSchema = z.enum(["low", "medium", "high", "not_assessed"]);
export const AgentStepStatusSchema = z.enum(["queued", "requested", "running", "completed", "needs_review", "failed", "skipped"]);

export const AgentEvidenceRefSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().optional(),
  verified: z.boolean().default(false),
});

export const AgentProposalSchema = z.object({
  id: z.string().min(1),
  workflowId: AgentWorkflowIdSchema,
  entity: z.string().min(1),
  action: z.enum(["create", "update", "delete", "link", "none"]),
  objectId: z.string().optional(),
  summary: z.string().min(1),
  confidence: AgentConfidenceSchema,
  evidenceIds: z.array(z.string()).default([]),
});

export const AgentWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  workflowId: AgentWorkflowIdSchema.optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const AgentStepSchema = z.object({
  workflowId: AgentWorkflowIdSchema,
  workflowVersion: z.string().min(1),
  promptVersion: z.string().optional(),
  model: z.string().optional(),
  status: AgentStepStatusSchema,
  summary: z.string().min(1),
  confidence: AgentConfidenceSchema,
  evidenceIds: z.array(z.string()).default([]),
  proposalIds: z.array(z.string()).default([]),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  attempt: z.number().int().positive().default(1),
  error: z.string().optional(),
  safeRecovery: z.string().optional(),
});

export const AgentRunEnvelopeSchema = z.object({
  contractVersion: z.literal(AGENT_CONTRACT_VERSION),
  executionId: z.string().min(1),
  correlationId: z.string().min(1),
  status: z.enum(["waiting", "running", "completed", "needs_review", "failed", "superseded"]),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  orchestrator: z.object({
    workflowId: z.literal("pmo.orchestrate"),
    workflowVersion: z.string().min(1),
    promptVersion: z.string().optional(),
    model: z.string().optional(),
  }),
  routing: z.object({
    mode: z.string().min(1),
    selectedWorkflows: z.array(AgentWorkflowIdSchema).min(1),
  }),
  steps: z.array(AgentStepSchema),
  evidence: z.array(AgentEvidenceRefSchema).default([]),
  proposals: z.array(AgentProposalSchema).default([]),
  warnings: z.array(AgentWarningSchema).default([]),
  persistence: z.object({
    mode: z.enum(["legacy_direct", "proposal_only", "governed_publish"]),
    revision: z.number().int().positive().optional(),
    commitSha: z.string().optional(),
  }),
  operations: z.object({
    attempt: z.number().int().positive().default(1),
    latencyMs: z.number().int().nonnegative().optional(),
    parentExecutionId: z.string().optional(),
    retryOf: z.string().optional(),
    replayOf: z.string().optional(),
    supersededBy: z.string().optional(),
    reviewOutcome: z.enum(["pending", "accepted", "rejected", "mixed", "not_required"]).default("pending"),
  }).default({ attempt: 1, reviewOutcome: "pending" }),
});

export type AgentRunEnvelope = z.infer<typeof AgentRunEnvelopeSchema>;

type LegacyAppliedChange = { entity: string; action: string; id?: string; summary?: string };

export function selectedAgentWorkflows(value: string | undefined): AgentWorkflowId[] {
  const parsed = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  const selected = parsed.flatMap((item) => {
    const result = AgentWorkflowIdSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
  return selected.length ? selected : SPECIALIST_AGENTS.map((agent) => agent.workflow);
}

export function legacyAgentRun(input: {
  meta: Record<string, string>;
  evidence: Array<{ name: string; contentHash?: string }>;
  appliedChanges?: LegacyAppliedChange[];
  needsReview?: string[];
  revision?: number;
  commitSha?: string;
  wpId?: string;
}): AgentRunEnvelope {
  const completedAt = new Date().toISOString();
  const legacyExecutionId = `legacy:${input.wpId || input.meta.wpId || "intake"}:${Date.now().toString(36)}`;
  const requestedAt = z.string().datetime().catch(completedAt).parse(input.meta.requested_at);
  const selectedWorkflows = selectedAgentWorkflows(input.meta.agent_workflows);
  const evidence = input.evidence.map((item, index) => ({
    id: item.contentHash ? `sha256:${item.contentHash}` : `evidence:${index + 1}`,
    label: item.name,
    source: `workbench:${input.wpId || input.meta.wpId || "intake"}`,
    verified: false,
  }));
  const proposals = (input.appliedChanges || []).map((change, index) => ({
    id: `legacy-proposal-${index + 1}`,
    workflowId: "governance.review" as const,
    entity: change.entity,
    action: ["create", "update", "delete", "link"].includes(change.action)
      ? change.action as "create" | "update" | "delete" | "link"
      : "none" as const,
    objectId: change.id,
    summary: change.summary || `${change.action} ${change.entity}`,
    confidence: "not_assessed" as const,
    evidenceIds: evidence.map((item) => item.id),
  }));
  const warnings = [
    {
      code: "LEGACY_DIRECT_PERSISTENCE",
      message: "This execution used the current monolithic workflow and persisted changes before the governed publisher boundary is introduced in ZM-PROD-05C.",
      evidenceIds: [],
    },
    ...(input.needsReview || []).map((message) => ({ code: "REVIEW_REQUIRED", message, evidenceIds: [] })),
  ];
  return AgentRunEnvelopeSchema.parse({
    contractVersion: AGENT_CONTRACT_VERSION,
    executionId: legacyExecutionId,
    correlationId: input.meta.correlation_id || `legacy:${input.wpId || input.meta.wpId || Date.now()}`,
    status: input.needsReview?.length ? "needs_review" : "completed",
    requestedAt,
    completedAt,
    orchestrator: { workflowId: "pmo.orchestrate", workflowVersion: "legacy-monolith-1.0" },
    routing: { mode: input.meta.routing || "auto", selectedWorkflows },
    steps: selectedWorkflows.map((workflowId) => ({
      workflowId,
      workflowVersion: "legacy-prompt-routing",
      status: "requested",
      summary: "Requested through the monolithic orchestrator; independent specialist execution is introduced in ZM-PROD-05B.",
      confidence: "not_assessed",
      evidenceIds: evidence.map((item) => item.id),
      proposalIds: workflowId === "governance.review" ? proposals.map((item) => item.id) : [],
    })),
    evidence,
    proposals,
    warnings,
    persistence: { mode: "legacy_direct", revision: input.revision, commitSha: input.commitSha },
    operations: { attempt: 1, latencyMs: 0, reviewOutcome: "pending" },
  });
}

