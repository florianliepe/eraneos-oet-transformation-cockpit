import { z } from "zod";
import { AgentEvidenceRefSchema, AgentWorkflowIdSchema } from "./agent-contracts";
import { ObjectTypeSchema } from "./pmo-schema";

export const PROPOSAL_SET_VERSION = "proposal-set-1.0" as const;
export const REVIEW_DECISION_VERSION = "review-decision-1.0" as const;

export const ProposalFieldChangeSchema = z.object({
  field: z.string().min(1),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

export const GovernedProposalSchema = z.object({
  id: z.string().min(1),
  sourceExecutionId: z.string().min(1),
  workflowId: AgentWorkflowIdSchema,
  entity: ObjectTypeSchema,
  action: z.enum(["create", "update", "delete"]),
  objectId: z.string().min(1),
  expectedObjectVersion: z.number().int().min(0),
  summary: z.string().min(1),
  risk: z.enum(["low", "medium", "high"]),
  evidenceIds: z.array(z.string().min(1)).min(1),
  fieldChanges: z.array(ProposalFieldChangeSchema).min(1),
  proposedObject: z.record(z.string(), z.unknown()).optional(),
});

export const ProposalAuditSchema = z.object({
  id: z.string().min(1),
  event: z.enum(["proposal.generated", "proposal.reviewed", "proposal.published", "proposal.duplicate"]),
  actor: z.string().min(1),
  at: z.string().datetime(),
  sourceExecutionId: z.string().min(1),
  rationale: z.string().optional(),
});

export const ProposalSetSchema = z.object({
  contractVersion: z.literal(PROPOSAL_SET_VERSION),
  id: z.string().min(1),
  sourceExecutionId: z.string().min(1),
  correlationId: z.string().min(1),
  sourceRevision: z.number().int().positive(),
  status: z.enum(["pending_review", "reviewed", "published", "rejected"]),
  createdAt: z.string().datetime(),
  proposals: z.array(GovernedProposalSchema),
  evidence: z.array(AgentEvidenceRefSchema),
  audit: z.array(ProposalAuditSchema).min(1),
});

export const ReviewDecisionSchema = z.object({
  proposalId: z.string().min(1),
  sourceExecutionId: z.string().min(1),
  decision: z.enum(["accept", "reject"]),
  reviewer: z.string().min(1),
  rationale: z.string(),
  decidedAt: z.string().datetime(),
  expectedObjectVersion: z.number().int().min(0),
});

export const ReviewBundleSchema = z.object({
  contractVersion: z.literal(REVIEW_DECISION_VERSION),
  id: z.string().min(1),
  proposalSetId: z.string().min(1),
  sourceExecutionId: z.string().min(1),
  reviewer: z.string().min(1),
  decidedAt: z.string().datetime(),
  decisions: z.array(ReviewDecisionSchema).min(1),
  audit: z.array(ProposalAuditSchema).min(1),
});

export const ProposalPublicationSchema = z.object({
  ok: z.boolean(),
  duplicate: z.boolean().default(false),
  proposalSetId: z.string().min(1),
  reviewBundleId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  acceptedProposalIds: z.array(z.string()),
  rejectedProposalIds: z.array(z.string()),
  revision: z.number().int().positive(),
  document: z.unknown().optional(),
  commit: z.object({ sha: z.string().optional(), url: z.string().optional() }).optional(),
});

export type GovernedProposal = z.infer<typeof GovernedProposalSchema>;
export type ProposalSet = z.infer<typeof ProposalSetSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type ReviewBundle = z.infer<typeof ReviewBundleSchema>;
export type ProposalPublication = z.infer<typeof ProposalPublicationSchema>;

export type DecisionInput = { proposalId: string; decision: "accept" | "reject"; rationale: string };

export function buildReviewBundle(proposalSet: ProposalSet, reviewer: string, inputs: DecisionInput[], at = new Date().toISOString()): ReviewBundle {
  const actor = reviewer.trim();
  if (!actor) throw new Error("Reviewer identity is required.");
  if (inputs.length !== proposalSet.proposals.length) throw new Error("Record one decision for every proposal.");
  const byId = new Map(inputs.map((input) => [input.proposalId, input]));
  const decisions = proposalSet.proposals.map((proposal) => {
    const input = byId.get(proposal.id);
    if (!input) throw new Error(`Missing review decision for ${proposal.id}.`);
    const rationale = input.rationale.trim();
    if (proposal.risk === "high" && rationale.length < 20) throw new Error(`High-impact decision ${proposal.id} requires a rationale of at least 20 characters.`);
    return ReviewDecisionSchema.parse({ proposalId: proposal.id, sourceExecutionId: proposalSet.sourceExecutionId, decision: input.decision, reviewer: actor, rationale, decidedAt: at, expectedObjectVersion: proposal.expectedObjectVersion });
  });
  return ReviewBundleSchema.parse({
    contractVersion: REVIEW_DECISION_VERSION,
    id: `REV-${proposalSet.id}-${at.replace(/[^0-9]/g, "").slice(0, 14)}`,
    proposalSetId: proposalSet.id,
    sourceExecutionId: proposalSet.sourceExecutionId,
    reviewer: actor,
    decidedAt: at,
    decisions,
    audit: [{ id: `PAUD-REVIEW-${proposalSet.id}`, event: "proposal.reviewed", actor, at, sourceExecutionId: proposalSet.sourceExecutionId, rationale: `${decisions.filter((item) => item.decision === "accept").length} accepted; ${decisions.filter((item) => item.decision === "reject").length} rejected.` }],
  });
}
