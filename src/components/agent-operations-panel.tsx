import type { AgentRunEnvelope } from "@/lib/agent-contracts";
import type { IntakeSubmission } from "./intake-workbench";

export type AgentRunHistoryEntry = {
  run: AgentRunEnvelope;
  submission: IntakeSubmission;
  recoveryMode?: "retry" | "replay";
  sourceExecutionId?: string;
};

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AgentOperationsPanel({ entries, busy, onRecover }: {
  entries: AgentRunHistoryEntry[];
  busy: boolean;
  onRecover: (entry: AgentRunHistoryEntry, mode: "retry" | "replay") => void;
}) {
  const states = ["failed", "waiting", "completed", "needs_review", "superseded"] as const;
  return <section className="agent-operations">
    <div className="agent-ops-summary">{states.map((state) => <div className="panel" key={state}><span>{label(state)}</span><b>{entries.filter((entry) => entry.run.status === state).length}</b></div>)}</div>
    <div className="panel agent-ops-list"><header><span className="section-kicker">RUN HISTORY</span><h2>Recoverable agent executions</h2><p>Retries preserve the original input and lineage. Replays evaluate the same input against the currently bound workflow versions; original executions remain immutable.</p></header>
      {entries.length === 0 ? <p>No agent runs recorded in this browser session.</p> : entries.map((entry) => {
        const failed = entry.run.steps.find((step) => step.status === "failed");
        const latency = entry.run.operations.latencyMs ?? (entry.run.completedAt ? Math.max(0, new Date(entry.run.completedAt).getTime() - new Date(entry.run.requestedAt).getTime()) : undefined);
        return <article className="agent-ops-row" key={entry.run.executionId}><div><span className={`agent-run-state agent-run-${entry.run.status}`}>{label(entry.run.status)}</span><b>{entry.run.executionId}</b><small>{entry.run.orchestrator.workflowVersion} · attempt {entry.run.operations.attempt} · {latency === undefined ? "waiting" : `${latency} ms`}</small>{entry.sourceExecutionId && <small>{label(entry.recoveryMode || "recovery")} of {entry.sourceExecutionId}</small>}</div><div><b>{failed ? `Failed: ${failed.workflowId}` : `${entry.run.steps.length} workflow steps`}</b><p>{failed?.error || failed?.summary || `Review outcome: ${label(entry.run.operations.reviewOutcome)}`}</p><small>{failed?.safeRecovery || (entry.run.status === "failed" ? "Retry the original version or replay against current bindings." : "No recovery action required.")}</small></div><div className="agent-ops-actions"><button disabled={busy} onClick={() => onRecover(entry, "retry")}>Retry original input</button><button disabled={busy} onClick={() => onRecover(entry, "replay")}>Replay current version</button></div></article>;
      })}
    </div>
  </section>;
}
