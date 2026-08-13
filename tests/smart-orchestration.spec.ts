import { expect, test } from "@playwright/test";
import { assessOrchestrationOutcome, planAgentRoute } from "../src/lib/smart-orchestration";
import type { AgentProposal, AgentStep } from "../src/lib/agent-contracts";

const step = (workflowId: AgentStep["workflowId"], confidence: AgentStep["confidence"] = "high"): AgentStep => ({ workflowId, workflowVersion: "1.2.0", status: "completed", summary: "Completed", confidence, evidenceIds: ["E-1"], proposalIds: [], attempt: 1 });
const proposal = (workflowId: AgentProposal["workflowId"], action: AgentProposal["action"], summary: string): AgentProposal => ({ id: `${workflowId}-${action}-${summary}`, workflowId, entity: "risk", action, objectId: "R-1", summary, confidence: "high", evidenceIds: ["E-1"] });

test("routes only evidence and risk specialists for a routine risk update", () => {
  const plan = planAgentRoute({ text: "A new supplier risk has high impact and needs mitigation.", evidenceCount: 1 });
  expect(plan.selectedWorkflows).toEqual(["evidence.verify", "risk.analyse"]);
  expect(plan.selectedWorkflows).not.toContain("meeting.synthesise");
  expect(plan.decisions.map((item) => item.sequence)).toEqual([1, 2]);
});

test("covers every required specialist across representative evidence classes without over-routing", () => {
  const cases = [
    ["Workshop minutes list attendees, a decision and an action.", ["evidence.verify", "meeting.synthesise", "controls.classify"]],
    ["Milestone schedule delay changes delivery progress.", ["evidence.verify", "delivery.plan"]],
    ["A dependency issue requires a change request approval.", ["evidence.verify", "controls.classify"]],
    ["An audit finding reports a compliance breach.", ["evidence.verify", "governance.review"]],
  ] as const;
  for (const [text, expected] of cases) expect(planAgentRoute({ text, evidenceCount: 1 }).selectedWorkflows).toEqual(expected);
});

test("terminates safely before model execution when evidence is absent", () => {
  const plan = planAgentRoute({ text: "", evidenceCount: 0 });
  expect(plan).toMatchObject({ evidenceSufficient: false, selectedWorkflows: [], humanReviewRequired: true, budget: { estimatedTokens: 0 } });
  expect(plan.terminationReason).toContain("no model");
});

test("enforces latency, token, cost and specialist budgets with review escalation", () => {
  const plan = planAgentRoute({ text: "Meeting risk milestone issue decision audit finding", evidenceCount: 1, budget: { maxSpecialists: 2, maxTokens: 3600, maxCostEur: 0.036, maxLatencyMs: 44000 } });
  expect(plan.selectedWorkflows).toHaveLength(2);
  expect(plan.budget).toMatchObject({ limited: true, estimatedTokens: 3600, estimatedLatencyMs: 44000 });
  expect(plan.humanReviewRequired).toBe(true);
});

test("requires accountable rationale for a manual routing override", () => {
  expect(() => planAgentRoute({ text: "Risk", evidenceCount: 1, mode: "manual", requested: ["risk.analyse"] })).toThrow(/actor and reason/);
  const plan = planAgentRoute({ text: "Risk", evidenceCount: 1, mode: "manual", requested: ["risk.analyse"], actor: "PMO Lead", overrideReason: "Validated specialist scope." });
  expect(plan.manualOverride).toEqual({ actor: "PMO Lead", reason: "Validated specialist scope." });
});

test("conflicts and low confidence always route to human review without canonical writes", () => {
  const plan = planAgentRoute({ text: "Risk evidence", evidenceCount: 1 });
  const outcome = assessOrchestrationOutcome({ plan, steps: [step("risk.analyse", "low"), step("governance.review")], proposals: [proposal("risk.analyse", "update", "Raise exposure"), proposal("governance.review", "update", "Keep exposure")] });
  expect(outcome).toMatchObject({ status: "needs_review", canonicalWriteAllowed: false, humanReviewRequired: true, conflicts: ["risk:R-1"], lowConfidence: ["risk.analyse"] });
});

test("smart routing preserves quality while reducing estimated execution versus all-specialist baseline", () => {
  const fixtures = ["Supplier risk impact and mitigation", "Milestone schedule progress", "Meeting minutes and attendees", "Dependency issue and action"];
  const plans = fixtures.map((text) => planAgentRoute({ text, evidenceCount: 1 }));
  expect(plans.every((plan) => plan.selectedWorkflows.includes("evidence.verify"))).toBe(true);
  expect(plans.every((plan) => !plan.selectedWorkflows.includes("governance.review"))).toBe(true);
  const smartCalls = plans.reduce((sum, plan) => sum + plan.selectedWorkflows.length, 0);
  const baselineCalls = fixtures.length * 6;
  expect(smartCalls).toBeLessThan(baselineCalls);
  expect(plans.reduce((sum, plan) => sum + plan.budget.estimatedTokens, 0)).toBeLessThan(baselineCalls * 1800);
  expect(plans.reduce((sum, plan) => sum + plan.budget.estimatedLatencyMs, 0)).toBeLessThan(fixtures.length * (6 * 18000 + 8000));
});
