"use client";

import { useMemo, useState } from "react";
import type { AgentOperationRecord, AgentOperatorState } from "@/lib/agent-operations";
import { classifyDuplicates, runEscalations, runProgress } from "@/lib/agent-control-plane";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const PAGE_SIZE = 10;

export function AgentOperationsPanel({ records, busy, onRecover, onUpdate }: {
  records: AgentOperationRecord[];
  busy: boolean;
  onRecover: (record: AgentOperationRecord, mode: "retry" | "replay") => void;
  onUpdate: (record: AgentOperationRecord, update: { state?: AgentOperatorState; owner?: string; note?: { author: string; message: string }; cancellation?: { actor: string; reason: string } }) => void;
}) {
  const [state, setState] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const runStates = ["failed", "waiting", "completed", "needs_review", "superseded"] as const;
  const filtered = useMemo(() => records.filter((record) => {
    if (state !== "all" && record.run.status !== state && record.operator.state !== state) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [record.executionId, record.run.correlationId, record.input.workPackageId, record.operator.owner, record.accountableActor.displayName, ...record.run.routing.selectedWorkflows].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
  }), [records, query, state]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);
  const duplicates = new Map(classifyDuplicates([...records].reverse()).map((item) => [item.executionId, item.duplicateOf]));

  function assign(record: AgentOperationRecord) {
    const owner = window.prompt("Assign this run to an accountable operator", record.operator.owner || "");
    if (owner?.trim()) onUpdate(record, { owner, state: record.operator.state === "unacknowledged" ? "acknowledged" : undefined });
  }

  function addNote(record: AgentOperationRecord) {
    const author = window.prompt("Operator name", record.operator.owner || "PMO operator");
    if (!author?.trim()) return;
    const message = window.prompt("Immutable operator note");
    if (message?.trim()) onUpdate(record, { note: { author, message } });
  }

  function requestCancellation(record: AgentOperationRecord) {
    const reason = window.prompt("Why should this execution be cancelled?");
    if (reason?.trim()) onUpdate(record, { cancellation: { actor: record.accountableActor.displayName, reason } });
  }

  return <section className="agent-operations">
    <div className="agent-ops-summary">{runStates.map((runState) => <div className="panel" key={runState}><span>{label(runState)}</span><b>{records.filter((record) => record.run.status === runState).length}</b></div>)}</div>
    <div className="panel agent-ops-list"><header><div><span className="section-kicker">PERSISTENT RUN HISTORY</span><h2>Recoverable agent executions</h2><p>Every run is bound to one organisation, project and accountable actor. Retry and replay preserve immutable lineage and duplicate classification; raw evidence remains encrypted on this device.</p></div><div className="agent-ops-filters"><input aria-label="Search agent runs" placeholder="Execution, correlation, work package or owner" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}/><select aria-label="Filter agent run state" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}><option value="all">All states</option>{[...runStates, "unacknowledged", "acknowledged", "resolved"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div></header>
      {visible.length === 0 ? <p>No persistent agent runs match the current filters.</p> : visible.map((record) => {
        const run = record.run;
        const failed = run.steps.find((step) => step.status === "failed");
        const latency = run.operations.latencyMs ?? (run.completedAt ? Math.max(0, new Date(run.completedAt).getTime() - new Date(run.requestedAt).getTime()) : undefined);
        const progress = runProgress(run);
        const escalations = runEscalations(run);
        const duplicateOf = duplicates.get(record.executionId);
        return <article className="agent-ops-row" key={run.executionId}><div><span className={`agent-run-state agent-run-${run.status}`}>{label(run.status)}</span><b>{run.executionId}</b><small>{run.orchestrator.workflowVersion} · attempt {run.operations.attempt} · {latency === undefined ? "waiting" : `${latency} ms`}</small><small>{progress.completed}/{progress.total} steps · {progress.percent}% · {label(progress.timeoutState)}</small><small>WP {record.input.workPackageId} · {record.input.evidence.length} evidence descriptor(s)</small><small>{record.accountableActor.displayName} · {record.scope.organisationId}/{record.scope.projectId}</small>{record.lineage.sourceExecutionId && <small>{label(record.lineage.recoveryMode || "recovery")} of {record.lineage.sourceExecutionId}</small>}</div><div><b>{failed ? `Failed: ${failed.workflowId}` : `${run.steps.length} workflow steps`}</b><p>{failed?.error || failed?.summary || `Review outcome: ${label(run.operations.reviewOutcome)}`}</p><small>{failed?.safeRecovery || (run.status === "failed" ? "Retry preserves the source version request; replay uses current workflow bindings." : "No recovery action required.")}</small><small>Idempotency {record.idempotency.key}{duplicateOf ? ` · duplicate of ${duplicateOf}` : " · unique lineage"}</small>{run.routing.explanation.map((item) => <small key={item.workflowId}>{item.sequence}. {item.workflowId}: {item.reason}</small>)}{escalations.map((item) => <strong className="agent-escalation" key={item}>{item}</strong>)}<div className="agent-ops-governance"><span>{label(record.operator.state)}</span><span>{record.operator.owner || "Unassigned"}</span><span>{record.operator.notes.length} note(s)</span><span>{label(record.cancellation.state)} cancellation</span></div></div><div className="agent-ops-actions"><button disabled={busy} onClick={() => onRecover(record, "retry")}>Retry original input</button><button disabled={busy} onClick={() => onRecover(record, "replay")}>Replay current version</button><button disabled={busy || !["running", "waiting"].includes(run.status) || record.cancellation.state === "requested"} title="Records an operator request; the current n8n binding does not expose remote cancellation." onClick={() => requestCancellation(record)}>Request cancellation</button><button disabled={busy} onClick={() => assign(record)}>Assign</button><button disabled={busy} onClick={() => onUpdate(record, { state: record.operator.state === "resolved" ? "acknowledged" : "resolved" })}>{record.operator.state === "resolved" ? "Reopen" : "Resolve"}</button><button disabled={busy} onClick={() => addNote(record)}>Add note</button></div></article>;
      })}
      <footer className="agent-ops-pagination"><span>{filtered.length} run{filtered.length === 1 ? "" : "s"} · page {Math.min(page, pageCount)} of {pageCount}</span><div><button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div></footer>
    </div>
  </section>;
}
