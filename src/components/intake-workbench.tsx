"use client";

import { useMemo, useRef, useState } from "react";
import { Icons } from "./icons";
import { AGENT_CONTRACT_VERSION, SPECIALIST_AGENTS, type AgentRunEnvelope } from "@/lib/agent-contracts";
import { AgentRunPanel } from "./agent-run-panel";
import { planAgentRoute } from "@/lib/smart-orchestration";

export type IntakeSubmission = {
  meta: Record<string, string>;
  files: File[];
  textUpdate: string;
};

function intakeId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `INTAKE-${stamp}`;
}

export function IntakeWorkbench({ saving, result, onRun }: { saving: boolean; result: AgentRunEnvelope | null; onRun: (submission: IntakeSubmission) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [textUpdate, setTextUpdate] = useState("");
  const [title, setTitle] = useState("");
  const [routing, setRouting] = useState("auto");
  const [agents, setAgents] = useState(["evidence", "delivery", "risk", "meeting", "controls", "governance"]);
  const [agentMode, setAgentMode] = useState<"auto" | "manual">("auto");
  const [overrideActor, setOverrideActor] = useState("PMO Lead");
  const [overrideReason, setOverrideReason] = useState("");
  const [maxSpecialists, setMaxSpecialists] = useState(4);
  const [dragging, setDragging] = useState(false);

  function addFiles(next: File[]) {
    setFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...next.filter((file) => !known.has(`${file.name}:${file.size}`))].slice(0, 20);
    });
  }

  function toggleAgent(id: string) {
    setAgents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const requested = useMemo(() => SPECIALIST_AGENTS.filter((agent) => agents.includes(agent.id)).map((agent) => agent.workflow), [agents]);
  const plan = useMemo(() => {
    try { return planAgentRoute({ text: textUpdate, evidenceCount: files.length, requested, mode: agentMode, actor: overrideActor, overrideReason, budget: { maxSpecialists } }); }
    catch { return null; }
  }, [textUpdate, files.length, requested, agentMode, overrideActor, overrideReason, maxSpecialists]);
  const canSubmit = !saving && Boolean(plan?.evidenceSufficient) && (agentMode === "auto" || Boolean(overrideActor.trim() && overrideReason.trim()));
  return <div className="intake-view">
    <section className="intake-hero">
      <div><span className="section-kicker">WORKBENCH INTAKE</span><h2>Turn project evidence into controlled updates.</h2><p>Drop source material or write an update. The n8n orchestrator classifies the evidence, delegates specialist analysis and proposes changes in the correct PMO views.</p></div>
      <div className="orchestrator-badge"><span className="ai-logo"><Icons.spark/></span><div><b>PMO Orchestrator</b><small>Evidence → conventions → PMO entities → GitHub revision</small></div><i/></div>
    </section>

    {result && <AgentRunPanel run={result}/>}

    <form className="intake-layout" onSubmit={(event) => {
      event.preventDefault();
      if (!canSubmit) return;
      onRun({
        files,
        textUpdate: textUpdate.trim(),
        meta: {
          wpId: intakeId(),
          title: title.trim() || "PMO workbench intake",
          owner_role: "PMO Lead",
          project: "Transformation Workspace",
          status: "active",
          rag: "amber",
          routing,
          agents: agents.join(","),
          agent_workflows: plan?.selectedWorkflows.join(",") || "",
          routing_policy: plan?.policyVersion || "smart-routing-1.0",
          routing_explanation: JSON.stringify(plan?.decisions || []),
          budget_max_specialists: String(maxSpecialists),
          budget_max_tokens: String(plan?.budget.maxTokens || 9000),
          budget_max_cost_eur: String(plan?.budget.maxCostEur || 0.1),
          budget_max_latency_ms: String(plan?.budget.maxLatencyMs || 45000),
          manual_override_actor: plan?.manualOverride?.actor || "",
          manual_override_reason: plan?.manualOverride?.reason || "",
          domain_schema: "pmo-2.0",
          agent_contract_version: AGENT_CONTRACT_VERSION,
          correlation_id: crypto.randomUUID(),
          requested_at: new Date().toISOString(),
        },
      });
    }}>
      <section className="panel intake-main">
        <div className="panel-head"><div><span className="section-kicker">01 · ADD EVIDENCE</span><h3>Documents and project updates</h3></div><span className="data-hint">PDF · Excel · Markdown · Images · Text</span></div>
        <button type="button" className={`drop-zone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
          <span className="drop-icon"><Icons.upload/></span><b>Drop files here or browse</b><small>Up to 20 files and 29 MB per intake. Content is extracted locally before transfer.</small>
        </button>
        <input ref={inputRef} className="visually-hidden" aria-label="Evidence files" type="file" multiple accept=".pdf,.md,.txt,.csv,.xlsx,.png,.jpg,.jpeg" onChange={(event) => addFiles(Array.from(event.target.files || []))}/>
        {files.length > 0 && <div className="file-queue">{files.map((file) => <div key={`${file.name}:${file.size}`}><span><Icons.document/></span><div><b>{file.name}</b><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div><button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><Icons.close/></button></div>)}</div>}
        <div className="intake-divider"><span>and / or</span></div>
        <label className="update-composer"><span>Write a project update</span><textarea value={textUpdate} onChange={(event) => setTextUpdate(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Paste meeting notes, describe a new risk, report progress, capture a decision or provide any other PMO-relevant update…"/><small>{textUpdate.length.toLocaleString("en-GB")} characters · Ctrl/⌘ + Enter submits</small></label>
      </section>

      <aside className="intake-side">
        <section className="panel routing-panel"><div className="panel-head"><div><span className="section-kicker">02 · ROUTE</span><h3>Analysis context</h3></div></div><label><span>Optional intake title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. August steering update"/></label><label><span>Primary destination</span><select value={routing} onChange={(event) => setRouting(event.target.value)}><option value="auto">Let orchestrator decide</option><option value="project">Project overview</option><option value="deliverables">Plan & deliverables</option><option value="risks">Risk register</option><option value="registers">PMO registers</option><option value="issues">Issues</option><option value="actions">Actions</option><option value="decisions">Decisions</option><option value="dependencies">Dependencies</option><option value="assumptions">Assumptions</option><option value="change_requests">Change requests</option><option value="governance">Evidence & governance</option><option value="meetings">Meeting hub</option></select></label></section>
        <section className="panel agent-panel"><div className="panel-head"><div><span className="section-kicker">03 · DELEGATE</span><h3>Specialist agents</h3></div></div><label className="agent-mode"><span>Routing control</span><select value={agentMode} onChange={(event) => setAgentMode(event.target.value as "auto" | "manual")}><option value="auto">Smart automatic routing</option><option value="manual">Accountable manual override</option></select></label><label className="agent-mode"><span>Maximum specialists</span><select value={maxSpecialists} onChange={(event) => setMaxSpecialists(Number(event.target.value))}>{[1,2,3,4,5,6].map((value) => <option key={value}>{value}</option>)}</select></label>{agentMode === "manual" && <div className="manual-routing"><label><span>Override actor</span><input value={overrideActor} onChange={(event) => setOverrideActor(event.target.value)}/></label><label><span>Override reason</span><textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Why is this routing override appropriate?"/></label></div>}<div className="agent-list">{SPECIALIST_AGENTS.map((agent) => <label key={agent.id} className={(agentMode === "manual" ? agents.includes(agent.id) : plan?.selectedWorkflows.includes(agent.workflow)) ? "selected" : ""}><input type="checkbox" disabled={agentMode === "auto"} checked={agentMode === "manual" ? agents.includes(agent.id) : Boolean(plan?.selectedWorkflows.includes(agent.workflow))} onChange={() => toggleAgent(agent.id)}/><span><b>{agent.title}</b><small>{agent.copy}</small></span></label>)}</div>{plan && <div className="routing-explanation" aria-live="polite"><b>{plan.selectedWorkflows.length} specialist(s) · ~{plan.budget.estimatedTokens.toLocaleString("en-GB")} tokens · ~€{plan.budget.estimatedCostEur.toFixed(3)} · ~{Math.round(plan.budget.estimatedLatencyMs/1000)}s</b>{plan.decisions.map((decision) => <p key={decision.workflowId}><span>{decision.sequence}</span>{SPECIALIST_AGENTS.find((agent) => agent.workflow === decision.workflowId)?.title}: {decision.reason}</p>)}{plan.terminationReason && <strong>{plan.terminationReason} Human review required.</strong>}</div>}</section>
        <button className="button primary orchestrate-button" disabled={!canSubmit}><Icons.spark/>{saving ? "Orchestrating…" : "Analyse and update workbench"}</button>
        <p className="intake-note">The orchestrator stores evidence-bound proposals only. Canonical PMO state changes only after accountable review and validation by the governed publisher.</p>
      </aside>
    </form>
  </div>;
}
