import type { ObjectRef, PmoDocument, Scenario } from "@/lib/pmo-schema";
import { validatePmoReferences } from "@/lib/pmo-domain";

const DAY = 86_400_000;
const dateFor = (document: PmoDocument, ref: ObjectRef) => {
  if (ref.type === "milestone") return document.milestones.find((item) => item.id === ref.id)?.date;
  if (ref.type === "deliverable") return document.deliverables.find((item) => item.id === ref.id)?.dueDate;
  return undefined;
};
const key = (ref: ObjectRef) => `${ref.type}:${ref.id}`;

export type DependencyEdge = { id: string; from: ObjectRef; to: ObjectRef; lagDays: number; assumption: string };
export type CriticalPath = { nodes: string[]; totalLagDays: number; assumptions: string[]; edges: DependencyEdge[] };

export function dependencyNetwork(document: PmoDocument): DependencyEdge[] {
  return document.dependencies.flatMap((dependency) => {
    const scheduleRefs = dependency.relatedObjects.filter((ref) => ref.type === "deliverable" || ref.type === "milestone");
    if (scheduleRefs.length < 2) return [];
    const fromDate = dateFor(document, scheduleRefs[0]);
    const toDate = dateFor(document, scheduleRefs[1]);
    const lagDays = fromDate && toDate ? Math.max(0, Math.round((new Date(`${toDate}T12:00:00Z`).getTime() - new Date(`${fromDate}T12:00:00Z`).getTime()) / DAY)) : 0;
    return [{ id: dependency.id, from: scheduleRefs[0], to: scheduleRefs[1], lagDays, assumption: `Related object order is provider → consumer; dates use governed due/gate dates for ${dependency.id}.` }];
  });
}

export function calculateCriticalPath(document: PmoDocument): CriticalPath {
  const edges = dependencyNetwork(document);
  const nodes = [...new Set(edges.flatMap((edge) => [key(edge.from), key(edge.to)]))];
  const incoming = new Map(nodes.map((node) => [node, 0]));
  const outgoing = new Map(nodes.map((node) => [node, [] as DependencyEdge[]]));
  for (const edge of edges) { incoming.set(key(edge.to), (incoming.get(key(edge.to)) || 0) + 1); outgoing.get(key(edge.from))?.push(edge); }
  const queue = nodes.filter((node) => incoming.get(node) === 0);
  const distance = new Map(nodes.map((node) => [node, 0]));
  const prior = new Map<string, { node: string; edge: DependencyEdge }>();
  let visited = 0;
  while (queue.length) {
    const node = queue.shift()!; visited++;
    for (const edge of outgoing.get(node) || []) {
      const target = key(edge.to);
      const candidate = (distance.get(node) || 0) + edge.lagDays;
      if (candidate >= (distance.get(target) || 0)) { distance.set(target, candidate); prior.set(target, { node, edge }); }
      incoming.set(target, (incoming.get(target) || 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  if (visited !== nodes.length) throw new Error("Dependency network contains a cycle; critical path is not defensible.");
  const end = nodes.sort((left, right) => (distance.get(right) || 0) - (distance.get(left) || 0))[0];
  const path = end ? [end] : [];
  const pathEdges: DependencyEdge[] = [];
  let cursor = end;
  while (cursor && prior.has(cursor)) { const link = prior.get(cursor)!; path.unshift(link.node); pathEdges.unshift(link.edge); cursor = link.node; }
  return { nodes: path, totalLagDays: end ? distance.get(end) || 0 : 0, assumptions: pathEdges.map((edge) => edge.assumption), edges };
}

export function programmeMetrics(document: PmoDocument) {
  const costBaseline = document.financials.filter((item) => item.category !== "benefit").reduce((sum, item) => sum + item.baseline, 0);
  const costForecast = document.financials.filter((item) => item.category !== "benefit").reduce((sum, item) => sum + item.forecast, 0);
  const costActual = document.financials.filter((item) => item.category !== "benefit").reduce((sum, item) => sum + (item.actual || 0), 0);
  const benefitTarget = document.benefits.reduce((sum, item) => sum + item.target, 0);
  const benefitForecast = document.benefits.reduce((sum, item) => sum + item.forecast, 0);
  const capacity = document.resourcePools.reduce((sum, item) => sum + item.capacityFte, 0);
  const demand = document.resourcePools.reduce((sum, item) => sum + item.demandFte, 0);
  return { costBaseline, costForecast, costActual, costVariance: costForecast - costBaseline, benefitTarget, benefitForecast, benefitGap: benefitForecast - benefitTarget, capacity, demand, capacityGap: capacity - demand };
}

export function compareScenarios(baseline: Scenario, candidate: Scenario) {
  return {
    baselineId: baseline.id,
    candidateId: candidate.id,
    scheduleDeltaDays: candidate.scheduleDeltaDays - baseline.scheduleDeltaDays,
    costDelta: candidate.costDelta - baseline.costDelta,
    benefitDelta: candidate.benefitDelta - baseline.benefitDelta,
    baselineImmutable: baseline.status === "approved",
    reviewRequired: candidate.status !== "approved",
  };
}

export function validateProgrammeDecisionSupport(document: PmoDocument) {
  const errors = validatePmoReferences(document);
  for (const portfolio of document.portfolios) for (const programmeId of portfolio.programmeIds) {
    const programme = document.programmes.find((item) => item.id === programmeId);
    if (programme && programme.portfolioId !== portfolio.id) errors.push(`${portfolio.id} and ${programme.id} have inconsistent hierarchy ownership.`);
  }
  try { calculateCriticalPath(document); } catch (error) { errors.push(error instanceof Error ? error.message : "Dependency network is invalid."); }
  const approved = document.scenarios.filter((item) => item.status === "approved");
  if (approved.some((scenario) => scenario.governance.reviewStatus !== "approved")) errors.push("Approved scenarios require approved governance metadata.");
  return errors;
}
