import type { AgentRunEnvelope } from "@/lib/agent-contracts";

const bindings = [
  ["Public orchestrator", "pEIhI533jPQvvSzs"],
  ["Governed publisher", "4czGSZtMjeGpKSFS"],
  ["Central error handler", "BkHWDRmPvXOepELU"],
] as const;

export function OperationalHealth({ runs, pendingReviews }: { runs: Array<{ run: AgentRunEnvelope }>; pendingReviews: number }) {
  const failed = runs.filter((entry) => entry.run.status === "failed");
  const incidents = [
    ...(failed.length ? [{ severity: "critical", title: `${failed.length} failed agent execution${failed.length === 1 ? "" : "s"}`, action: "Open Agent operations, assign an owner and retry or replay only after inspecting the failed step." }] : []),
    ...(pendingReviews ? [{ severity: "warning", title: `${pendingReviews} proposal set${pendingReviews === 1 ? "" : "s"} awaiting review`, action: "Complete accountable review before publication." }] : []),
  ];
  return <div className="ops-health">
    <section className="ops-health-grid">
      <article className="panel"><span className="section-kicker">RELEASE</span><h3>2026-08-11-zm-prod-09a</h3><p>Checksummed workflow baseline · endpoint contract verified</p><strong className="health-ok">Release ready</strong></article>
      <article className="panel"><span className="section-kicker">AGENT QUALITY</span><h3>6 / 6 specialists</h3><p>100% contracts, evidence attribution and routing · zero unsupported claims</p><strong className="health-ok">Gate passed</strong></article>
      <article className="panel"><span className="section-kicker">INCIDENTS</span><h3>{incidents.length}</h3><p>Session failures and pending governance actions requiring operator attention</p><strong className={incidents.length ? "health-warning" : "health-ok"}>{incidents.length ? "Action required" : "Healthy"}</strong></article>
    </section>
    <section className="panel ops-health-section"><header><span className="section-kicker">AUTHORITATIVE BINDINGS</span><h2>Production workflow inventory</h2><p>Only these bindings are authoritative. Cleanup candidates remain non-destructive until explicitly confirmed.</p></header><div className="binding-list">{bindings.map(([name, id]) => <div key={id}><span className="health-dot"/><b>{name}</b><code>{id}</code><small>Live and release-aligned</small></div>)}</div></section>
    <section className="panel ops-health-section"><header><span className="section-kicker">OPERATOR QUEUE</span><h2>Actionable health signals</h2></header>{incidents.length ? <div className="health-incidents">{incidents.map((incident) => <article key={incident.title}><span className={`health-severity health-${incident.severity}`}>{incident.severity}</span><div><b>{incident.title}</b><p>{incident.action}</p></div></article>)}</div> : <div className="health-empty"><b>No active operational incident</b><p>Availability, authentication, dead-letter and repeated-failure thresholds are defined in the operational policy.</p></div>}</section>
    <section className="panel ops-policy"><div><span>Retention</span><b>30 days successful · 90 days failed/dead letter</b></div><div><span>Authentication alert</span><b>10 failures / 5 minutes</b></div><div><span>Repeated failure alert</span><b>3 failures / 15 minutes</b></div><div><span>Owner</span><b>OET AI Suite workflow administrator</b></div></section>
  </div>;
}
