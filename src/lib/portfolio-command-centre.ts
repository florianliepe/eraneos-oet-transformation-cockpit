import type { AgentOperationRecord } from "./agent-operations";
import type { CockpitView } from "./cockpit-navigation";
import type { PmoDocument, Rag } from "./pmo-schema";
import type { ProjectWorkspace } from "./workspace-schema";

export const PORTFOLIO_COMMAND_CONTRACT_VERSION = "portfolio-command-centre-1.0" as const;

export type PortfolioFilters = {
  status: "all" | ProjectWorkspace["status"];
  owner: string;
  period: "all" | "30" | "90";
  attention: "all" | "critical" | "pending_review" | "stale";
};

export const defaultPortfolioFilters: PortfolioFilters = { status: "active", owner: "all", period: "90", attention: "all" };

export type PortfolioProjectSource = {
  workspace: ProjectWorkspace;
  dataState: "stored" | "missing" | "invalid";
  document?: PmoDocument;
  incidents: AgentOperationRecord[];
  error?: string;
};

export type PortfolioSignal = { label: string; count: number; view: CockpitView; source: string };
export type PortfolioProjectSummary = {
  project: ProjectWorkspace;
  dataState: PortfolioProjectSource["dataState"];
  health: Rag | "unknown";
  updatedAt: string;
  stale: boolean;
  owners: string[];
  signals: Record<"milestones" | "risks" | "issues" | "decisions" | "actions" | "reviews" | "incidents", PortfolioSignal>;
  onboarding: { completed: number; total: number };
  error?: string;
};

export type PortfolioDependency = { sourceProjectId: string; sourceProjectName: string; targetProjectId: string; targetProjectName: string; id: string; title: string; status: string; criticality: string };
export type PortfolioCapacityConstraint = { projectId: string; projectName: string; id: string; name: string; period: string; capacityFte: number; demandFte: number };
export type PortfolioCommandCentre = {
  contractVersion: typeof PORTFOLIO_COMMAND_CONTRACT_VERSION;
  organisationId: string;
  generatedAt: string;
  summaries: PortfolioProjectSummary[];
  totals: Record<keyof PortfolioProjectSummary["signals"], number>;
  dependencies: PortfolioDependency[];
  capacityConstraints: PortfolioCapacityConstraint[];
  recentProjects: Array<{ projectId: string; projectName: string; updatedAt: string; view: CockpitView }>;
  missingProjects: number;
};

const DAY = 86_400_000;
function inPeriod(value: string | undefined, cutoff: number) { return cutoff === 0 || !value || new Date(value).getTime() >= cutoff; }
function isFailed(record: AgentOperationRecord) { return record.run.status === "failed" || record.run.steps.some((step) => step.status === "failed"); }

export function buildPortfolioCommandCentre(organisationId: string, sources: PortfolioProjectSource[], filters: PortfolioFilters, now = new Date()): PortfolioCommandCentre {
  if (sources.some((source) => source.workspace.organisationId !== organisationId)) throw new Error("Portfolio aggregation rejected a project outside the authorised organisation.");
  const cutoff = filters.period === "all" ? 0 : now.getTime() - Number(filters.period) * DAY;
  const availableIds = new Map(sources.map((source) => [source.workspace.id, source.workspace.name]));
  const allSummaries = sources.map((source): PortfolioProjectSummary => {
    const document = source.document;
    const updatedAt = document?.project.updatedAt || source.workspace.updatedAt;
    const stale = now.getTime() - new Date(updatedAt).getTime() > 30 * DAY;
    const owners = document ? [...new Set([
      ...document.workstreams.map((item) => item.owner), ...document.milestones.map((item) => item.owner),
      ...document.risks.map((item) => item.owner), ...document.issues.map((item) => item.owner),
      ...document.actions.map((item) => item.owner), ...document.decisions.map((item) => item.owner),
    ])].sort() : [];
    const signal = (label: string, count: number, view: CockpitView, sourceLabel: string): PortfolioSignal => ({ label, count, view, source: sourceLabel });
    const milestones = document?.milestones.filter((item) => item.status !== "complete" && inPeriod(item.date, cutoff)).length || 0;
    const risks = document?.risks.filter((item) => item.state !== "closed" && inPeriod(item.updatedAt, cutoff)).length || 0;
    const issues = document?.issues.filter((item) => !["resolved", "closed"].includes(item.status) && inPeriod(item.raisedAt, cutoff)).length || 0;
    const decisions = document?.decisions.filter((item) => item.status === "proposed" && inPeriod(item.decisionDate, cutoff)).length || 0;
    const actions = document?.actions.filter((item) => !["done", "cancelled"].includes(item.status) && inPeriod(item.dueDate, cutoff)).length || 0;
    const reviews = document?.reviews.filter((item) => item.status === "pending" && inPeriod(item.requestedAt, cutoff)).length || 0;
    const incidents = source.incidents.filter(isFailed).length;
    const completed = document ? [document.project.governance.evidenceIds.length > 0, document.workstreams.length > 0, document.milestones.length > 0, document.risks.length + document.issues.length > 0, document.reviews.length > 0].filter(Boolean).length : 0;
    return {
      project: source.workspace, dataState: source.dataState, health: document?.project.overallRag || "unknown", updatedAt, stale, owners,
      signals: {
        milestones: signal("Open milestones", milestones, "plan", `${document?.milestones.length || 0} governed milestone records`),
        risks: signal("Open risks", risks, "risks", `${document?.risks.length || 0} governed risk records`),
        issues: signal("Open issues", issues, "registers", `${document?.issues.length || 0} governed issue records`),
        decisions: signal("Decisions required", decisions, "registers", `${document?.decisions.length || 0} governed decision records`),
        actions: signal("Open actions", actions, "registers", `${document?.actions.length || 0} governed action records`),
        reviews: signal("Pending reviews", reviews, "review", `${document?.reviews.length || 0} governed review records`),
        incidents: signal("Agent incidents", incidents, "operations", `${source.incidents.length} project-scoped run records`),
      },
      onboarding: { completed, total: 5 }, error: source.error,
    };
  });
  const summaries = allSummaries.filter((summary) => {
    if (filters.status !== "all" && summary.project.status !== filters.status) return false;
    if (filters.owner !== "all" && !summary.owners.includes(filters.owner)) return false;
    if (filters.attention === "critical" && summary.health !== "red" && summary.signals.risks.count === 0 && summary.signals.issues.count === 0) return false;
    if (filters.attention === "pending_review" && summary.signals.reviews.count === 0) return false;
    if (filters.attention === "stale" && !summary.stale) return false;
    return true;
  });
  const totals = { milestones: 0, risks: 0, issues: 0, decisions: 0, actions: 0, reviews: 0, incidents: 0 };
  for (const summary of summaries) for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += summary.signals[key].count;
  const visibleIds = new Set(summaries.map((summary) => summary.project.id));
  const dependencies = sources.flatMap((source) => source.document?.dependencies.flatMap((dependency) => dependency.relatedObjects.filter((reference) => reference.type === "project" && reference.id !== source.workspace.id && availableIds.has(reference.id)).map((reference) => ({ sourceProjectId: source.workspace.id, sourceProjectName: source.workspace.name, targetProjectId: reference.id, targetProjectName: availableIds.get(reference.id)!, id: dependency.id, title: dependency.title, status: dependency.status, criticality: dependency.criticality }))) || []).filter((item) => visibleIds.has(item.sourceProjectId) && visibleIds.has(item.targetProjectId));
  const capacityConstraints = sources.flatMap((source) => source.document?.resourcePools.filter((pool) => pool.status === "constrained" || pool.demandFte > pool.capacityFte).map((pool) => ({ projectId: source.workspace.id, projectName: source.workspace.name, id: pool.id, name: pool.name, period: pool.period, capacityFte: pool.capacityFte, demandFte: pool.demandFte })) || []).filter((item) => visibleIds.has(item.projectId));
  const recentProjects = [...summaries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 3).map((summary) => ({ projectId: summary.project.id, projectName: summary.project.name, updatedAt: summary.updatedAt, view: "overview" as const }));
  return { contractVersion: PORTFOLIO_COMMAND_CONTRACT_VERSION, organisationId, generatedAt: now.toISOString(), summaries, totals, dependencies, capacityConstraints, recentProjects, missingProjects: summaries.filter((summary) => summary.dataState !== "stored").length };
}
