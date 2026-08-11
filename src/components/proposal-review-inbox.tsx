"use client";

import { useMemo, useState } from "react";
import type { DecisionInput, ProposalSet } from "@/lib/governed-proposals";
import { Icons } from "./icons";

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function display(value: unknown) {
  if (value === undefined) return "Not set";
  if (value === null) return "Null";
  if (typeof value === "string") return value || "Empty";
  return JSON.stringify(value);
}

export function ProposalReviewInbox({ proposalSets, busy, onSubmit }: {
  proposalSets: ProposalSet[];
  busy: boolean;
  onSubmit: (proposalSet: ProposalSet, reviewer: string, decisions: DecisionInput[]) => Promise<void>;
}) {
  const pending = proposalSets.filter((item) => item.status === "pending_review");
  const [activeId, setActiveId] = useState(pending[0]?.id || proposalSets[0]?.id || "");
  const [reviewer, setReviewer] = useState("PMO Lead");
  const [decisions, setDecisions] = useState<Record<string, { decision: "accept" | "reject"; rationale: string }>>({});
  const active = useMemo(() => proposalSets.find((item) => item.id === activeId) || pending[0] || proposalSets[0], [activeId, pending, proposalSets]);

  if (!active) return <section className="panel proposal-empty"><span className="section-kicker">AGENT REVIEW</span><h3>No proposal sets waiting</h3><p>Run evidence through the specialist workbench to create an immutable proposal set. Agents cannot change canonical PMO state before this review.</p></section>;

  const decisionFor = (proposalId: string) => decisions[proposalId] || { decision: "reject" as const, rationale: "" };
  const setDecision = (proposalId: string, update: Partial<{ decision: "accept" | "reject"; rationale: string }>) => setDecisions((current) => ({ ...current, [proposalId]: { ...decisionFor(proposalId), ...update } }));
  const submit = async () => onSubmit(active, reviewer, active.proposals.map((proposal) => ({ proposalId: proposal.id, ...decisionFor(proposal.id) })));

  return <div className="proposal-review-layout">
    <aside className="panel proposal-set-list"><header><span className="section-kicker">INBOX</span><h3>Proposal sets</h3></header>{proposalSets.map((set) => <button key={set.id} className={set.id === active.id ? "active" : ""} onClick={() => setActiveId(set.id)}><b>{set.id}</b><span>{set.proposals.length} changes · revision {set.sourceRevision}</span><small>{label(set.status)}</small></button>)}</aside>
    <section className="proposal-review-main">
      <header className="panel proposal-review-head"><div><span className="section-kicker">HUMAN GOVERNANCE GATE</span><h2>Review agent proposals</h2><p>Execution {active.sourceExecutionId} generated these proposals. Accepting a field does not publish it until the dedicated publisher revalidates evidence, authorization, object versions and idempotency.</p></div><label><span>Accountable reviewer</span><input value={reviewer} onChange={(event) => setReviewer(event.target.value)}/></label></header>
      {active.proposals.map((proposal) => { const decision = decisionFor(proposal.id); return <article className="panel proposal-review-card" key={proposal.id}>
        <header><div><span className={`proposal-risk proposal-risk-${proposal.risk}`}>{proposal.risk} impact</span><h3>{proposal.summary}</h3><small>{proposal.entity} · {proposal.action} · {proposal.objectId} · expected version {proposal.expectedObjectVersion}</small></div><div className="proposal-decision"><button className={decision.decision === "accept" ? "selected accept" : ""} onClick={() => setDecision(proposal.id, { decision: "accept" })}><Icons.check/>Accept</button><button className={decision.decision === "reject" ? "selected reject" : ""} onClick={() => setDecision(proposal.id, { decision: "reject" })}>Reject</button></div></header>
        <div className="proposal-diff"><div className="proposal-diff-head"><span>Field</span><span>Current</span><span>Proposed</span></div>{proposal.fieldChanges.map((change) => <div className="proposal-diff-row" key={change.field}><b>{label(change.field)}</b><code>{display(change.before)}</code><code>{display(change.after)}</code></div>)}</div>
        <footer><span>{proposal.evidenceIds.length} evidence reference{proposal.evidenceIds.length === 1 ? "" : "s"}</span><label><span>Decision rationale {proposal.risk === "high" && "(required, minimum 20 characters)"}</span><textarea value={decision.rationale} onChange={(event) => setDecision(proposal.id, { rationale: event.target.value })} placeholder="Record evidence reviewed and the reason for this decision."/></label></footer>
      </article>; })}
      <div className="proposal-review-actions"><p>Rejected proposals remain immutable and never change canonical state. Accepted proposals create one governed revision after the publisher gate.</p><button className="button primary" disabled={busy || active.status !== "pending_review" || !reviewer.trim()} onClick={() => void submit()}>{busy ? "Publishing governed decision..." : "Record review and publish accepted"}</button></div>
    </section>
  </div>;
}
