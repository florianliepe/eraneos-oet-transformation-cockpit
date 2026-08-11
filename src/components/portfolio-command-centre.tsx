"use client";

import { useEffect, useMemo, useState } from "react";
import { listAgentOperationRecords } from "@/lib/agent-operations-store";
import type { CockpitView } from "@/lib/cockpit-navigation";
import { buildPortfolioCommandCentre, defaultPortfolioFilters, type PortfolioFilters, type PortfolioProjectSource } from "@/lib/portfolio-command-centre";
import type { ProjectDataRepository } from "@/lib/project-data-repository";
import type { ProjectWorkspace } from "@/lib/workspace-schema";

const filterKey = (accountId: string, organisationId: string) => `oet:workspace:v1:portfolio-filters:${accountId}:${organisationId}`;
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function storedFilters(accountId: string, organisationId: string): PortfolioFilters {
  try { return { ...defaultPortfolioFilters, ...JSON.parse(window.localStorage.getItem(filterKey(accountId, organisationId)) || "{}") }; }
  catch { return defaultPortfolioFilters; }
}

export function PortfolioCommandCentre({ accountId, organisationId, projects, repository, onOpen }: {
  accountId: string;
  organisationId: string;
  projects: ProjectWorkspace[];
  repository: ProjectDataRepository;
  onOpen: (project: ProjectWorkspace, view: CockpitView) => void;
}) {
  const [sources, setSources] = useState<PortfolioProjectSource[]>([]);
  const [filters, setFilters] = useState<PortfolioFilters>(defaultPortfolioFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => { queueMicrotask(() => setFilters(storedFilters(accountId, organisationId))); }, [accountId, organisationId]);
  useEffect(() => {
    let active = true; queueMicrotask(() => { if (active) setLoading(true); });
    void Promise.all(projects.map(async (project): Promise<PortfolioProjectSource> => {
      const scope = { organisationId, projectId: project.id, projectName: project.name };
      try {
        const [data, incidents] = await Promise.all([repository.inspect(scope), listAgentOperationRecords(scope).catch(() => [])]);
        return data.state === "stored" ? { workspace: project, dataState: "stored", document: data.document, incidents } : { workspace: project, dataState: "missing", incidents };
      } catch (reason) {
        return { workspace: project, dataState: "invalid", incidents: [], error: reason instanceof Error ? reason.message : "Project data is invalid." };
      }
    })).then((next) => { if (active) setSources(next); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organisationId, projects, repository]);

  function update<K extends keyof PortfolioFilters>(key: K, value: PortfolioFilters[K]) {
    const next = { ...filters, [key]: value }; setFilters(next); window.localStorage.setItem(filterKey(accountId, organisationId), JSON.stringify(next));
  }

  const centre = useMemo(() => buildPortfolioCommandCentre(organisationId, sources, filters), [filters, organisationId, sources]);
  const owners = useMemo(() => [...new Set(sources.flatMap((source) => source.document ? [
    ...source.document.workstreams.map((item) => item.owner), ...source.document.milestones.map((item) => item.owner),
    ...source.document.risks.map((item) => item.owner), ...source.document.issues.map((item) => item.owner),
    ...source.document.actions.map((item) => item.owner), ...source.document.decisions.map((item) => item.owner),
  ] : []))].sort(), [sources]);

  return <section className="portfolio-command-centre" aria-labelledby="portfolio-command-title">
    <header><div><span className="public-kicker">PORTFOLIO COMMAND CENTRE</span><h2 id="portfolio-command-title">Decision signals across authorised projects</h2><p>Every count is derived from the selected organisation&apos;s project-scoped records. Missing local project data is never replaced with demonstration metrics.</p></div><b>{projects.length} project{projects.length === 1 ? "" : "s"}</b></header>
    <div className="portfolio-filters" aria-label="Portfolio filters">
      <label><span>Status</span><select value={filters.status} onChange={(event) => update("status", event.target.value as PortfolioFilters["status"])}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
      <label><span>Owner</span><select value={filters.owner} onChange={(event) => update("owner", event.target.value)}><option value="all">All owners</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
      <label><span>Reporting period</span><select value={filters.period} onChange={(event) => update("period", event.target.value as PortfolioFilters["period"])}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All governed records</option></select></label>
      <label><span>Attention</span><select value={filters.attention} onChange={(event) => update("attention", event.target.value as PortfolioFilters["attention"])}><option value="all">All attention states</option><option value="critical">Critical exposure</option><option value="pending_review">Pending review</option><option value="stale">Stale updates</option></select></label>
    </div>
    {loading ? <p className="portfolio-empty" role="status">Loading authorised project signals…</p> : <>
      {centre.missingProjects > 0 && <div className="portfolio-partial" role="status"><b>Partial portfolio data</b><span>{centre.missingProjects} visible project{centre.missingProjects === 1 ? " has" : "s have"} no valid browser-local PMO document. Its metrics remain unavailable until governed data is saved.</span></div>}
      {centre.recentProjects.length > 0 && <nav className="portfolio-recent" aria-label="Recent projects"><b>Recent projects</b>{centre.recentProjects.map((item) => <button key={item.projectId} onClick={() => onOpen(projects.find((project) => project.id === item.projectId)!, item.view)}><span>{item.projectName}</span><small>{new Date(item.updatedAt).toLocaleDateString("en-GB")}</small></button>)}</nav>}
      <div className="portfolio-totals">{([
        ["milestones", "Milestones", "plan"], ["risks", "Risks", "risks"], ["issues", "Issues", "registers"], ["decisions", "Decisions", "registers"], ["actions", "Actions", "registers"], ["reviews", "Reviews", "review"], ["incidents", "Agent incidents", "operations"],
      ] as const).map(([key, label]) => <article key={key}><span>{label}</span><b>{centre.totals[key]}</b><small>Across {centre.summaries.filter((summary) => summary.dataState === "stored").length} data-ready project(s)</small></article>)}</div>
      <div className="portfolio-projects">{centre.summaries.map((summary) => <article key={summary.project.id} className={`portfolio-project portfolio-health-${summary.health}`}>
        <header><div><span>{titleCase(summary.project.status)} · Health {titleCase(summary.health)} · {summary.dataState === "stored" ? "Governed data available" : titleCase(summary.dataState)}</span><h3>{summary.project.name}</h3><small>Updated {new Date(summary.updatedAt).toLocaleDateString("en-GB")}{summary.stale ? " · stale over 30 days" : ""}</small></div><button onClick={() => onOpen(summary.project, "overview")}>Open overview</button></header>
        {summary.dataState !== "stored" ? <p className="portfolio-missing">{summary.error || "No governed browser-local PMO document is stored for this project."}</p> : <><div className="portfolio-signal-grid">{Object.entries(summary.signals).map(([key, signal]) => <button key={key} title={signal.source} onClick={() => onOpen(summary.project, signal.view)}><span>{signal.label}</span><b>{signal.count}</b><small>{signal.source}</small></button>)}</div><footer><span>Onboarding {summary.onboarding.completed}/{summary.onboarding.total}</span><span>{summary.owners.length ? summary.owners.join(" · ") : "No accountable owners recorded"}</span></footer></>}
      </article>)}</div>
      {!centre.summaries.length && <p className="portfolio-empty">No projects match the saved portfolio filters. Change a filter to restore the decision view.</p>}
      <div className="portfolio-cross-grid">
        <section><header><span className="public-kicker">DEPENDENCIES</span><h3>Cross-project commitments</h3></header>{centre.dependencies.map((item) => <article key={`${item.sourceProjectId}:${item.id}:${item.targetProjectId}`}><div><b>{item.title}</b><span>{item.sourceProjectName} → {item.targetProjectName}</span><small>{titleCase(item.criticality)} · {titleCase(item.status)} · source {item.id}</small></div><button onClick={() => onOpen(projects.find((project) => project.id === item.sourceProjectId)!, "registers")}>Inspect source</button></article>)}{!centre.dependencies.length && <p>No explicit dependency links between visible projects.</p>}</section>
        <section><header><span className="public-kicker">CAPACITY</span><h3>Constraints requiring attention</h3></header>{centre.capacityConstraints.map((item) => <article key={`${item.projectId}:${item.id}`}><div><b>{item.name}</b><span>{item.projectName} · {item.period}</span><small>{item.demandFte} FTE demand / {item.capacityFte} FTE capacity · source {item.id}</small></div><button onClick={() => onOpen(projects.find((project) => project.id === item.projectId)!, "portfolio")}>Open capacity</button></article>)}{!centre.capacityConstraints.length && <p>No constrained governed resource pools in the visible project set.</p>}</section>
      </div>
    </>}
  </section>;
}
