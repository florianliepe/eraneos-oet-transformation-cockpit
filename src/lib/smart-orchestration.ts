import type { AgentConfidence, AgentProposal, AgentStep, AgentWarning, AgentWorkflowId } from "./agent-contracts";

export type OrchestrationBudget = { maxSpecialists: number; maxTokens: number; maxCostEur: number; maxLatencyMs: number };
export type RoutingDecision = { workflowId: AgentWorkflowId; reason: string; sequence: number; estimatedTokens: number; estimatedCostEur: number; estimatedLatencyMs: number };
export type OrchestrationPlan = {
  policyVersion: "smart-routing-1.1.0"; evidenceSufficient: boolean; selectedWorkflows: AgentWorkflowId[]; decisions: RoutingDecision[];
  budget: OrchestrationBudget & { estimatedTokens: number; estimatedCostEur: number; estimatedLatencyMs: number; limited: boolean };
  humanReviewRequired: boolean; terminationReason?: string; manualOverride?: { actor: string; reason: string };
};

const UNIT = { estimatedTokens: 1800, estimatedCostEur: 0.018, estimatedLatencyMs: 60000 };
const CONSOLIDATION_LATENCY_MS = 90000;
const rules: Array<{ workflowId: AgentWorkflowId; terms: RegExp; reason: string }> = [
  { workflowId: "meeting.synthesise", terms: /meeting|minutes|attendee|agenda|workshop|discussion/i, reason: "Meeting language requires decision/action synthesis." },
  { workflowId: "risk.analyse", terms: /risk|threat|probability|impact|mitigation|exposure/i, reason: "Risk or exposure language requires risk analysis." },
  { workflowId: "delivery.plan", terms: /milestone|deliverable|deadline|schedule|plan|progress|delay/i, reason: "Delivery commitments require plan analysis." },
  { workflowId: "controls.classify", terms: /issue|action|decision|dependency|assumption|change request|approval/i, reason: "PMO control language requires register classification." },
  { workflowId: "governance.review", terms: /audit|governance|evidence|review|compliance|approve/i, reason: "Governance language requires accountable review analysis." },
];
const unique = <T,>(values: T[]) => [...new Set(values)];

export function planAgentRoute(input: {
  text: string; evidenceCount: number; requested?: AgentWorkflowId[]; mode?: "auto" | "manual";
  actor?: string; overrideReason?: string; budget?: Partial<OrchestrationBudget>;
}): OrchestrationPlan {
  const budget: OrchestrationBudget = { maxSpecialists: 4, maxTokens: 9000, maxCostEur: 0.1, maxLatencyMs: 360000, ...input.budget };
  if (!input.text.trim() && input.evidenceCount === 0) return { policyVersion: "smart-routing-1.1.0", evidenceSufficient: false, selectedWorkflows: [], decisions: [], budget: { ...budget, estimatedTokens: 0, estimatedCostEur: 0, estimatedLatencyMs: 0, limited: false }, humanReviewRequired: true, terminationReason: "No evidence or update text was supplied; no model was called." };
  const manual = input.mode === "manual" && input.requested?.length;
  if (manual && (!input.actor?.trim() || !input.overrideReason?.trim())) throw new Error("Manual routing requires an accountable actor and reason.");
  let selected = manual ? unique(input.requested || []) : rules.filter((rule) => rule.terms.test(input.text)).map((rule) => rule.workflowId);
  if (input.evidenceCount > 0 || input.text.trim()) selected.unshift("evidence.verify");
  selected = unique(selected);
  if (!selected.length) selected = ["evidence.verify"];
  if (selected.some((item) => item !== "evidence.verify") && !selected.includes("governance.review")) selected.push("governance.review");
  const ordered = (["evidence.verify", "meeting.synthesise", "risk.analyse", "delivery.plan", "controls.classify", "governance.review"] as AgentWorkflowId[]).filter((id) => selected.includes(id));
  const within = ordered.filter((_, index) => index < budget.maxSpecialists && (index + 1) * UNIT.estimatedTokens <= budget.maxTokens && (index + 1) * UNIT.estimatedCostEur <= budget.maxCostEur && (index + 1) * UNIT.estimatedLatencyMs + CONSOLIDATION_LATENCY_MS <= budget.maxLatencyMs);
  const limited = within.length < ordered.length;
  const decisions = within.map((workflowId, index) => ({ workflowId, reason: manual ? `Manual override: ${input.overrideReason}` : workflowId === "evidence.verify" ? "Evidence is verified before dependent specialists execute." : rules.find((rule) => rule.workflowId === workflowId)?.reason || "Final governance review is sequenced after specialist analysis.", sequence: index + 1, ...UNIT }));
  return {
    policyVersion: "smart-routing-1.1.0", evidenceSufficient: true, selectedWorkflows: within, decisions,
    budget: { ...budget, estimatedTokens: within.length * UNIT.estimatedTokens, estimatedCostEur: within.length * UNIT.estimatedCostEur, estimatedLatencyMs: within.length ? within.length * UNIT.estimatedLatencyMs + CONSOLIDATION_LATENCY_MS : 0, limited },
    humanReviewRequired: limited, ...(limited ? { terminationReason: "Execution budget excluded one or more relevant specialists; canonical writes remain disabled." } : {}),
    ...(manual ? { manualOverride: { actor: input.actor!.trim(), reason: input.overrideReason!.trim() } } : {}),
  };
}

export function assessOrchestrationOutcome(input: { plan: OrchestrationPlan; steps: AgentStep[]; proposals: AgentProposal[]; warnings?: AgentWarning[] }) {
  const conflicts: string[] = [];
  const grouped = new Map<string, AgentProposal[]>();
  input.proposals.forEach((proposal) => { const key = `${proposal.entity}:${proposal.objectId || "new"}`; grouped.set(key, [...(grouped.get(key) || []), proposal]); });
  grouped.forEach((items, key) => { if (new Set(items.map((item) => `${item.action}:${item.summary.trim().toLowerCase()}`)).size > 1) conflicts.push(key); });
  const lowConfidence = input.steps.filter((step) => (["low", "not_assessed"] as AgentConfidence[]).includes(step.confidence)).map((step) => step.workflowId);
  const budgetLimited = input.plan.budget.limited;
  const needsReview = budgetLimited || conflicts.length > 0 || lowConfidence.length > 0 || Boolean(input.warnings?.length);
  return { status: needsReview ? "needs_review" as const : "completed" as const, conflicts, lowConfidence, budgetLimited, canonicalWriteAllowed: false, humanReviewRequired: needsReview || input.proposals.length > 0 };
}
