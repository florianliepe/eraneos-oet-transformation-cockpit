import { SPECIALIST_AGENTS, type AgentRunEnvelope, type AgentWorkflowId } from "@/lib/agent-contracts";

const titles = new Map<AgentWorkflowId, string>(SPECIALIST_AGENTS.map((agent) => [agent.workflow, agent.title]));

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AgentRunPanel({ run }: { run: AgentRunEnvelope }) {
  return (
    <section className="panel agent-run-panel" aria-label="Agent execution result">
      <header className="agent-run-head">
        <div>
          <span className="section-kicker">AGENT EXECUTION</span>
          <h3>{run.status === "needs_review" ? "Review required" : statusLabel(run.status)}</h3>
          <p>{run.routing.selectedWorkflows.length} specialist workflow{run.routing.selectedWorkflows.length === 1 ? "" : "s"} requested · {run.proposals.length} proposed change{run.proposals.length === 1 ? "" : "s"}</p>
        </div>
        <span className={`agent-run-state agent-run-${run.status}`}>{statusLabel(run.status)}</span>
      </header>

      <div className="agent-run-trace">
        <span><b>Execution</b>{run.executionId}</span>
        <span><b>Correlation</b>{run.correlationId}</span>
        <span><b>Contract</b>{run.contractVersion}</span>
        <span><b>Persistence</b>{statusLabel(run.persistence.mode)}</span>
        <span><b>Attempt</b>{run.operations.attempt}</span>
        <span><b>Latency</b>{run.operations.latencyMs === undefined ? "Pending" : `${run.operations.latencyMs} ms`}</span>
        <span><b>Review</b>{statusLabel(run.operations.reviewOutcome)}</span>
      </div>

      <div className="agent-step-list">
        {run.steps.map((step) => (
          <article key={step.workflowId} className="agent-step">
            <span className={`agent-step-dot agent-step-${step.status}`} aria-hidden="true" />
            <div>
              <b>{titles.get(step.workflowId) || step.workflowId}</b>
              <small>{step.workflowId} · {step.workflowVersion}</small>
              <p>{step.summary}</p>
            </div>
            <span className="agent-step-status">{statusLabel(step.status)}</span>
          </article>
        ))}
      </div>

      {(run.proposals.length > 0 || run.evidence.length > 0) && (
        <div className="agent-run-grid">
          <section>
            <h4>Proposed changes</h4>
            {run.proposals.length ? run.proposals.map((proposal) => (
              <article className="agent-proposal" key={proposal.id}>
                <span>{proposal.action} · {proposal.entity}</span>
                <b>{proposal.summary}</b>
                <small>{titles.get(proposal.workflowId)} · {statusLabel(proposal.confidence)} confidence</small>
              </article>
            )) : <p className="agent-empty">No changes proposed.</p>}
          </section>
          <section>
            <h4>Evidence trace</h4>
            {run.evidence.length ? run.evidence.map((evidence) => (
              <article className="agent-evidence" key={evidence.id}>
                <b>{evidence.label}</b>
                <small>{evidence.verified ? "Verified" : "Verification pending"} · {evidence.id}</small>
              </article>
            )) : <p className="agent-empty">No evidence references returned.</p>}
          </section>
        </div>
      )}

      {run.warnings.length > 0 && <div className="agent-warning-list">{run.warnings.map((warning, index) => <p key={`${warning.code}-${index}`}><b>{warning.code}</b>{warning.message}</p>)}</div>}
    </section>
  );
}
