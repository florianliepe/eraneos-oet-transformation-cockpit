"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "./icons";
import type { Deliverable, PmoDocument, Rag, Risk } from "@/lib/pmo-schema";
import { ingestEvidence, loadPmoDocument, reviewAndPublishProposalSet, savePmoDocument } from "@/lib/n8n-client";
import { DeleteDialog, EntityEditor, splitCsv, type EditableEntity, type EditorTarget } from "./entity-editor";
import { IntakeWorkbench, type IntakeSubmission } from "./intake-workbench";
import { DomainRegisters } from "./domain-registers";
import { deletePmoRecord, governedCollections, linkedRecordCount, updateProject, upsertPmoRecord } from "@/lib/pmo-domain";
import { SteercoReadOnly, SteercoWorkbench } from "./steerco-summary";
import { loadSteercoShare } from "@/lib/steerco-client";
import type { SteercoSnapshot } from "@/lib/steerco-schema";
import { BrandMark } from "./brand-mark";
import { AgentRunEnvelopeSchema, selectedAgentWorkflows, type AgentRunEnvelope } from "@/lib/agent-contracts";
import { ProposalReviewInbox } from "./proposal-review-inbox";
import type { DecisionInput, ProposalSet } from "@/lib/governed-proposals";
import { AgentOperationsPanel } from "./agent-operations-panel";
import { OperationalHealth } from "./operational-health";
import { GlobalSearch } from "./global-search";
import { buildAgentOperationRecord, updateAgentOperationRecord, type AgentOperationRecord } from "@/lib/agent-operations";
import { listAgentOperationRecords, loadEncryptedRecoveryInput, saveAgentOperationRecord, saveEncryptedRecoveryInput } from "@/lib/agent-operations-store";

type View = "intake" | "review" | "operations" | "health" | "overview" | "plan" | "risks" | "registers" | "meetings" | "steerco" | "activity";
type IntakeType = "risk" | "issue" | "action" | "decision" | "change_request" | "deliverable" | "meeting";
type DeleteTarget = { entity: Exclude<EditableEntity, "project">; id: string; label: string; blockedReason?: string };

const navigation: Array<{ id: View; label: string; icon: keyof typeof Icons }> = [
  { id: "intake", label: "Workbench intake", icon: "upload" },
  { id: "review", label: "Agent review inbox", icon: "activity" },
  { id: "operations", label: "Agent operations", icon: "activity" },
  { id: "health", label: "Operational health", icon: "dashboard" },
  { id: "overview", label: "Executive overview", icon: "dashboard" },
  { id: "plan", label: "Plan & deliverables", icon: "plan" },
  { id: "risks", label: "Risk register", icon: "risk" },
  { id: "registers", label: "PMO registers", icon: "plan" },
  { id: "meetings", label: "Meeting hub", icon: "meeting" },
  { id: "steerco", label: "SteerCo summary", icon: "dashboard" },
  { id: "activity", label: "Activity log", icon: "activity" },
];

const viewMeta: Record<View, { eyebrow: string; title: string; description: string }> = {
  intake: { eyebrow: "PMO workbench", title: "Ingest and orchestrate", description: "Convert project evidence into governed, reviewable updates." },
  review: { eyebrow: "Human governance", title: "Agent review inbox", description: "Compare, accept or reject evidence-bound proposals before canonical publication." },
  operations: { eyebrow: "Agent operations", title: "Execution control", description: "Inspect run health, versions, latency and safe recovery lineage." },
  health: { eyebrow: "Production operations", title: "Operational health", description: "Release readiness, authoritative bindings and actionable incident signals." },
  overview: { eyebrow: "Control tower", title: "Executive overview", description: "One live view of delivery health, decisions and exposure." },
  plan: { eyebrow: "Delivery", title: "Plan & deliverables", description: "Track gate milestones and workstream commitments." },
  risks: { eyebrow: "RAID", title: "Risk register", description: "Prioritise exposure and keep mitigation ownership visible." },
  registers: { eyebrow: "Governed domain", title: "PMO registers", description: "Control issues, actions, decisions, dependencies, assumptions, change and their evidence." },
  meetings: { eyebrow: "Collaboration", title: "Meeting hub", description: "Turn discussions into decisions, actions and evidence." },
  steerco: { eyebrow: "Executive reporting", title: "SteerCo summary", description: "Generate, approve and publish a traceable read-only project view." },
  activity: { eyebrow: "Traceability", title: "Activity log", description: "A chronological audit trail across people and automations." },
};

function cx(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(" "); }
const DISPLAY_TIME_ZONE = "Europe/Berlin";
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(value: string, compact = false) {
  return new Intl.DateTimeFormat("en-GB", compact
    ? { day: "2-digit", month: "short", timeZone: DISPLAY_TIME_ZONE }
    : { day: "2-digit", month: "short", year: "numeric", timeZone: DISPLAY_TIME_ZONE })
    .format(new Date(`${value}T12:00:00Z`));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value));
}
function datePart(value: string, part: "day" | "month") {
  return new Intl.DateTimeFormat("en", part === "day"
    ? { day: "numeric", timeZone: DISPLAY_TIME_ZONE }
    : { month: "short", timeZone: DISPLAY_TIME_ZONE })
    .format(new Date(`${value}T12:00:00Z`));
}
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function riskScore(risk: Risk) { return risk.probability * risk.impact; }
function relativeDay(value: string, anchor: string) {
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round((new Date(value).getTime() - new Date(anchor).getTime()) / 86_400_000), "day");
}

function RagDot({ rag, label = true }: { rag: Rag; label?: boolean }) {
  return <span className={cx("rag", `rag-${rag}`)}><i />{label && titleCase(rag)}</span>;
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: Rag }) {
  return <div className="progress-track" aria-label={`${value}% complete`}><span className={`progress-${tone}`} style={{ width: `${value}%` }} /></div>;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "done" || status === "complete" ? "success" : status === "blocked" || status === "at_risk" ? "danger" : "neutral";
  return <span className={`status-pill status-${tone}`}>{titleCase(status)}</span>;
}

export default function ControlTower({ initialData }: { initialData: PmoDocument }) {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<PmoDocument | null>(initialData);
  const [source, setSource] = useState<"github" | "bootstrap">("bootstrap");
  const [storageConfigured, setStorageConfigured] = useState(false);
  const [workspaceSecret, setWorkspaceSecret] = useState("");
  const [accessOpen, setAccessOpen] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<AgentRunEnvelope | null>(null);
  const [proposalSets, setProposalSets] = useState<ProposalSet[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [runHistory, setRunHistory] = useState<AgentOperationRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sharedSnapshot, setSharedSnapshot] = useState<SteercoSnapshot | null>(null);
  const [shareRequested, setShareRequested] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("steerco")?.trim();
    if (!shareId) return;
    queueMicrotask(() => { setShareRequested(true); setAccessOpen(false); });
    void loadSteercoShare(shareId)
      .then((payload) => {
        if (!payload.snapshot) throw new Error("The read-only SteerCo snapshot is unavailable.");
        if (payload.snapshot.status !== "published") throw new Error("This SteerCo link is not active.");
        setSharedSnapshot(payload.snapshot);
      })
      .catch((reason) => setShareError(reason instanceof Error ? reason.message : "The read-only SteerCo link could not be loaded."));
  }, []);

  async function loadData(secret = workspaceSecret) {
    setLoading(true); setError("");
    try {
      const payload = await loadPmoDocument(secret);
      if (!payload.ok || !payload.document) throw new Error(payload.error || "Unable to load project data.");
      setData(payload.document); setSource(payload.source || "bootstrap"); setStorageConfigured(Boolean(payload.storageConfigured)); setDirty(false);
      setWorkspaceSecret(secret); setAccessOpen(false); setAccessError("");
      setRunHistory(await listAgentOperationRecords());
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "Unable to load project data.";
      if (accessOpen) setAccessError(message); else setError(message);
    }
    finally { setLoading(false); }
  }

  function mutate(update: (current: PmoDocument) => PmoDocument) {
    setData((current) => current ? update(current) : current); setDirty(true);
  }

  function requestDelete(entity: DeleteTarget["entity"], id: string, label: string) {
    const links = data ? linkedRecordCount(data, { type: entity, id }) : 0;
    setDeleteTarget({
      entity,
      id,
      label,
      blockedReason: links
        ? `Remove or redirect ${links} linked record${links === 1 ? "" : "s"} before deleting this object.`
        : undefined,
    });
  }

  async function publish() {
    if (!data) return;
    setSaving(true); setError("");
    try {
      const payload = await savePmoDocument(workspaceSecret, data);
      if (!payload.ok || !payload.document) throw new Error(payload.error || "Publish failed.");
      setData(payload.document); setSource("github"); setDirty(false); setPublishOpen(false);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Publish failed."); }
    finally { setSaving(false); }
  }

  async function persistAgentRun(run: AgentRunEnvelope, submission: IntakeSubmission, recovery?: { mode: "retry" | "replay"; source: AgentOperationRecord }) {
    const descriptor = {
      workPackageId: submission.meta.wpId || "unassigned",
      textUpdatePresent: Boolean(submission.textUpdate.trim()),
      evidence: submission.files.map((file) => ({ name: file.name, mediaType: file.type || "application/octet-stream", size: file.size })),
    };
    const record = buildAgentOperationRecord({ run, descriptor, source: recovery?.source, recoveryMode: recovery?.mode });
    setRunHistory((current) => [record, ...current.filter((item) => item.executionId !== record.executionId)]);
    try {
      await saveEncryptedRecoveryInput(workspaceSecret, record.input.ref, submission);
      await saveAgentOperationRecord(record);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? `Run completed, but persistent recovery storage failed: ${reason.message}` : "Run completed, but persistent recovery storage failed.");
    }
    return record;
  }

  async function runWorkflowIntake(submission: IntakeSubmission, recovery?: { mode: "retry" | "replay"; source: AgentOperationRecord }) {
    const { meta, files, textUpdate } = submission;
    setWorkflowSaving(true); setError(""); setWorkflowResult(null);
    try {
      const payload = await ingestEvidence(workspaceSecret, meta, files, textUpdate);
      if (!payload.ok) throw new Error(payload.error || "Workflow intake failed.");
      const refreshed = payload.document ? { ok: true, document: payload.document, source: "github" as const, storageConfigured: true } : await loadPmoDocument(workspaceSecret);
      if (refreshed.document) {
        setData(refreshed.document);
        setSource(refreshed.source || "github");
        setStorageConfigured(Boolean(refreshed.storageConfigured));
        setDirty(false);
      }
      if (!payload.agentRun) throw new Error("The workflow response did not contain a valid agent execution contract.");
      const recoveredRun = recovery ? AgentRunEnvelopeSchema.parse({ ...payload.agentRun, operations: { ...payload.agentRun.operations, attempt: recovery.source.run.operations.attempt + 1, ...(recovery.mode === "retry" ? { retryOf: recovery.source.executionId } : { replayOf: recovery.source.executionId }) } }) : payload.agentRun;
      setWorkflowResult(recoveredRun);
      await persistAgentRun(recoveredRun, submission, recovery);
      if (payload.proposalSet) setProposalSets((current) => [payload.proposalSet!, ...current.filter((item) => item.id !== payload.proposalSet!.id)]);
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "Workflow intake failed.";
      const timestamp = new Date().toISOString();
      const executionId = `failed:${Date.now()}`;
      const workflows = selectedAgentWorkflows(meta.agent_workflows);
      const failedRun = AgentRunEnvelopeSchema.parse({ contractVersion: "agent-run-1.0", executionId, correlationId: meta.correlation_id || executionId, status: "failed", requestedAt: meta.requested_at || timestamp, completedAt: timestamp, orchestrator: { workflowId: "pmo.orchestrate", workflowVersion: "request-boundary" }, routing: { mode: meta.routing || "selected", selectedWorkflows: workflows }, steps: [{ workflowId: workflows[0], workflowVersion: "request-boundary", status: "failed", summary: message, confidence: "not_assessed", evidenceIds: [], proposalIds: [], startedAt: meta.requested_at || timestamp, completedAt: timestamp, error: message, safeRecovery: "Retry the original input; replay only after checking workflow release notes." }], evidence: [], proposals: [], warnings: [{ code: "AGENT_EXECUTION_FAILED", message, evidenceIds: [] }], persistence: { mode: "proposal_only" }, operations: { attempt: Number(meta.recovery_attempt || 1), latencyMs: Math.max(0, Date.now() - new Date(meta.requested_at || timestamp).getTime()), retryOf: meta.retry_of, replayOf: meta.replay_of, reviewOutcome: "pending" } });
      setWorkflowResult(failedRun); await persistAgentRun(failedRun, submission, recovery); setError(message);
    }
    finally { setWorkflowSaving(false); }
  }

  async function reviewProposalSet(proposalSet: ProposalSet, reviewer: string, decisions: DecisionInput[]) {
    if (!data) return;
    setReviewBusy(true); setError("");
    try {
      const publication = await reviewAndPublishProposalSet(workspaceSecret, proposalSet, reviewer, decisions, data.revision);
      if (!publication.ok) throw new Error("The governed publisher rejected the review bundle.");
      if (publication.document) setData(publication.document);
      const nextStatus = publication.acceptedProposalIds.length ? "published" : "rejected";
      setProposalSets((current) => current.map((item) => item.id === proposalSet.id ? { ...item, status: nextStatus } : item));
      const reviewOutcome = publication.acceptedProposalIds.length && publication.rejectedProposalIds.length ? "mixed" : publication.acceptedProposalIds.length ? "accepted" : "rejected";
      setRunHistory((current) => current.map((record) => {
        if (record.executionId !== proposalSet.sourceExecutionId) return record;
        const updated = { ...record, recordVersion: record.recordVersion + 1, run: { ...record.run, operations: { ...record.run.operations, reviewOutcome } }, updatedAt: new Date().toISOString() } as AgentOperationRecord;
        void saveAgentOperationRecord(updated).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Review outcome persistence failed."));
        return updated;
      }));
      setSource("github"); setStorageConfigured(true); setDirty(false);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Governed publication failed."); }
    finally { setReviewBusy(false); }
  }

  async function recoverRun(record: AgentOperationRecord, mode: "retry" | "replay") {
    try {
      const attempt = record.run.operations.attempt + 1;
      const latestVersions = runHistory[0]?.versions.workflows || record.versions.workflows;
      const differences = Object.entries(record.versions.workflows).filter(([workflowId, version]) => latestVersions[workflowId] && latestVersions[workflowId] !== version);
      if (mode === "replay") {
        const detail = differences.length ? differences.map(([workflowId, version]) => `${workflowId}: ${version} → ${latestVersions[workflowId]}`).join("\n") : "No version difference is visible in the local run index; live bindings will still be used.";
        if (!window.confirm(`Replay against current workflow versions?\n\n${detail}\n\nThe original execution remains immutable.`)) return;
      }
      const original = await loadEncryptedRecoveryInput(workspaceSecret, record.input.ref);
      const submission = { ...original, meta: { ...original.meta, correlation_id: record.run.correlationId, requested_at: new Date().toISOString(), recovery_attempt: String(attempt), recovery_version_policy: mode === "retry" ? "source_versions" : "current_versions", source_workflow_versions: JSON.stringify(record.versions), ...(mode === "retry" ? { retry_of: record.executionId } : { replay_of: record.executionId }) } };
      await runWorkflowIntake(submission, { mode, source: record });
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Recovery failed."); }
  }

  async function updateRun(record: AgentOperationRecord, update: Parameters<typeof updateAgentOperationRecord>[1]) {
    try {
      const next = updateAgentOperationRecord(record, update);
      await saveAgentOperationRecord(next);
      setRunHistory((current) => current.map((item) => item.executionId === next.executionId ? next : item));
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Run ownership update failed."); }
  }

  function addRecord(type: IntakeType, values: Record<string, string>) {
    if (!data) return;
    const stamp = new Date().toISOString();
    const prefix: Record<IntakeType, string> = { risk: "R", issue: "ISS", action: "ACTN", decision: "DEC", change_request: "CR", deliverable: "DEL", meeting: "MTG" };
    const id = `${prefix[type]}-${Date.now().toString().slice(-6)}`;
    mutate((current) => {
      if (type === "risk") return upsertPmoRecord(current, "risk", { id, title: values.title, description: values.description, probability: Number(values.probability), impact: Number(values.impact), state: "open", owner: values.owner, mitigation: values.mitigation, updatedAt: today() }, "PMO user", stamp);
      if (type === "issue") return upsertPmoRecord(current, "issue", { id, title: values.title, description: values.description, owner: values.owner, status: "open", priority: "P2", severity: Number(values.severity || 3), raisedAt: today(), dueDate: values.date || undefined, resolution: "", relatedRiskIds: [], workstreamId: values.workstream || undefined }, "PMO user", stamp);
      if (type === "action") return upsertPmoRecord(current, "action", { id, title: values.title, description: values.description, owner: values.owner, status: "open", priority: "P2", dueDate: values.date, relatedObjects: [] }, "PMO user", stamp);
      if (type === "decision") return upsertPmoRecord(current, "decision", { id, title: values.title, context: values.description, decision: values.decision || values.description, owner: values.owner, status: "proposed", decisionDate: values.date, impact: "", relatedObjects: [] }, "PMO user", stamp);
      if (type === "change_request") return upsertPmoRecord(current, "change_request", { id, title: values.title, description: values.description, requester: values.owner, owner: values.owner, status: "draft", priority: "P2", submittedAt: today(), decisionDueDate: values.date || undefined, scopeImpact: "", scheduleImpact: "", costImpact: "", benefitImpact: "", riskImpact: "" }, "PMO user", stamp);
      if (type === "deliverable") return upsertPmoRecord(current, "deliverable", { id, title: values.title, workstream: values.workstream, dueDate: values.date, status: "not_started", owner: values.owner, progress: 0, priority: "P2" }, "PMO user", stamp);
      return upsertPmoRecord(current, "meeting", { id, title: values.title, date: values.date, type: "working_session", participants: splitCsv(values.participants), summary: values.description, decisionIds: [], actionIds: [] }, "PMO user", stamp);
    });
    setIntakeOpen(false);
  }

  function saveEntity(target: EditorTarget, values: Record<string, string>) {
    const prefix: Record<Exclude<EditableEntity, "project">, string> = {
      workstream: "WS", milestone: "M", deliverable: "DEL", risk: "R", issue: "ISS",
      action: "ACTN", decision: "DEC", dependency: "DEP", assumption: "ASM",
      change_request: "CR", meeting: "MTG",
    };
    const id = target.id || (target.entity === "project" ? data?.project.id : `${prefix[target.entity]}-${Date.now().toString().slice(-6)}`);
    const stamp = new Date().toISOString();
    const evidenceIds = splitCsv(values.evidenceIds || "");
    mutate((current) => {
      if (target.entity === "project") {
        return updateProject(current, {
          id: current.project.id, name: values.name, subtitle: values.subtitle, phase: values.phase,
          startDate: values.startDate, endDate: values.endDate, overallRag: values.overallRag as Rag,
          progress: Math.max(0, Math.min(100, Number(values.progress))), updatedAt: stamp,
        }, "PMO user", stamp, evidenceIds);
      }
      const key = governedCollections[target.entity];
      const existing = (current[key] as Array<Record<string, unknown> & { id: string }>).find((item) => item.id === target.id);
      let record: Record<string, unknown> & { id: string };
      if (target.entity === "workstream") record = { id: id!, name: values.name, shortName: values.shortName, owner: values.owner, progress: Math.max(0, Math.min(100, Number(values.progress))), rag: values.rag };
      else if (target.entity === "milestone") record = { id: id!, title: values.title, phase: values.phase, date: values.date, status: values.status, owner: values.owner, description: values.description };
      else if (target.entity === "deliverable") record = { id: id!, title: values.title, workstream: values.workstream, dueDate: values.dueDate, status: values.status, owner: values.owner, progress: Math.max(0, Math.min(100, Number(values.progress))), priority: values.priority };
      else if (target.entity === "risk") record = { id: id!, title: values.title, description: values.description, probability: Number(values.probability), impact: Number(values.impact), state: values.state, owner: values.owner, mitigation: values.mitigation, updatedAt: today() };
      else if (target.entity === "issue") record = { id: id!, title: values.title, description: values.description, owner: values.owner, status: values.status, priority: values.priority, severity: Number(values.severity), raisedAt: values.raisedAt, dueDate: values.dueDate || undefined, resolution: values.resolution, workstreamId: values.workstreamId || undefined, relatedRiskIds: splitCsv(values.relatedRiskIds || "") };
      else if (target.entity === "action") record = { id: id!, title: values.title, description: values.description, owner: values.owner, status: values.status, priority: values.priority, dueDate: values.dueDate, completedAt: values.status === "done" ? stamp : existing?.completedAt, relatedObjects: existing?.relatedObjects ?? [] };
      else if (target.entity === "decision") record = { id: id!, title: values.title, context: values.context, decision: values.decision, owner: values.owner, status: values.status, decisionDate: values.decisionDate, approver: values.approver || undefined, effectiveDate: values.effectiveDate || undefined, impact: values.impact, relatedObjects: existing?.relatedObjects ?? [] };
      else if (target.entity === "dependency") record = { id: id!, title: values.title, description: values.description, owner: values.owner, provider: values.provider, type: values.type, direction: values.direction, status: values.status, criticality: values.criticality, neededBy: values.neededBy, relatedObjects: existing?.relatedObjects ?? [] };
      else if (target.entity === "assumption") record = { id: id!, title: values.title, statement: values.statement, owner: values.owner, status: values.status, criticality: values.criticality, validationDueDate: values.validationDueDate, validationMethod: values.validationMethod, impactIfFalse: values.impactIfFalse };
      else if (target.entity === "change_request") record = { id: id!, title: values.title, description: values.description, requester: values.requester, owner: values.owner, status: values.status, priority: values.priority, submittedAt: values.submittedAt, decisionDueDate: values.decisionDueDate || undefined, scopeImpact: values.scopeImpact, scheduleImpact: values.scheduleImpact, costImpact: values.costImpact, benefitImpact: values.benefitImpact, riskImpact: values.riskImpact, decisionId: values.decisionId || undefined };
      else record = { id: id!, title: values.title, date: values.date, type: values.type, participants: splitCsv(values.participants), summary: values.summary, decisionIds: splitCsv(values.decisionIds), actionIds: splitCsv(values.actionIds) };
      return upsertPmoRecord(current, target.entity, record, "PMO user", stamp, evidenceIds);
    });
    setEditor(null);
  }

  function deleteEntity(target: DeleteTarget) {
    if (target.blockedReason) return;
    mutate((current) => deletePmoRecord(current, target.entity, target.id, target.label));
    setDeleteTarget(null);
  }

  const exposure = useMemo(() => data?.risks.filter((risk) => risk.state !== "closed").reduce((sum, risk) => sum + riskScore(risk), 0) ?? 0, [data]);
  const openActions = useMemo(() => data?.actions.filter((action) => !["done", "cancelled"].includes(action.status)).length ?? 0, [data]);
  const completedDeliverables = data?.deliverables.filter((item) => item.status === "done").length ?? 0;
  const query = search.trim().toLowerCase();

  if (shareRequested && sharedSnapshot) return <SteercoReadOnly snapshot={sharedSnapshot}/>;
  if (shareRequested && !shareError) return <div className="app-loading" role="status" aria-live="polite"><BrandMark/><div className="loading-line"/><p>Loading approved SteerCo snapshot...</p></div>;
  if (shareRequested && shareError) return <div className="app-loading" role="alert"><BrandMark/><p>{shareError}</p><small>The link may have expired or been revoked. Request a new approved link from the PMO.</small></div>;
  if (loading) return <div className="app-loading" role="status" aria-live="polite"><BrandMark/><div className="loading-line"/><p>Connecting to the project control tower...</p></div>;
  if (!data) return <div className="app-loading" role="alert"><BrandMark/><p>{error || "Project data is unavailable."}</p><button className="button primary" onClick={() => void loadData()}>Try again</button></div>;

  const meta = viewMeta[view];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#cockpit-content">Skip to cockpit content</a>
      {mobileNav && <button className="nav-scrim mobile-only" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
      <aside className={cx("sidebar", mobileNav && "sidebar-open")} aria-label="Project navigation">
        <div className="sidebar-head"><BrandMark/><button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="Close navigation"><Icons.close/></button></div>
        <div className="project-switcher"><span className="project-monogram">TC</span><div><b>Transformation Workspace</b><small>OET AI Suite</small></div><Icons.chevron/></div>
        <nav aria-label="Primary navigation">
          <span className="nav-label">Project control</span>
          {navigation.map((item) => { const NavIcon = Icons[item.icon]; const count = item.id === "risks" ? data.risks.filter((risk) => risk.state !== "closed").length : item.id === "review" ? proposalSets.filter((set) => set.status === "pending_review").length : 0; return <button key={item.id} className={cx("nav-item", view === item.id && "active")} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setMobileNav(false); }}><NavIcon/><span>{item.label}</span>{count > 0 && <em>{count}</em>}</button>; })}
        </nav>
        <div className="sidebar-roadmap"><span>PRODUCT FOUNDATION</span><b>Governed transformation delivery</b><p>Evidence-backed project control with accountable AI assistance.</p><button onClick={() => setView("steerco")}>Open executive reporting <Icons.arrow/></button></div>
        <div className="sidebar-foot"><span className="user-avatar">PM</span><div><b>PMO Lead</b><small>Programme workspace</small></div><span className="online-dot"/></div>
      </aside>

      <main className="main-area" id="cockpit-content" tabIndex={-1}>
        <header className="topbar"><button className="icon-button mobile-only" aria-expanded={mobileNav} onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icons.menu/></button><GlobalSearch data={data} value={search} onChange={setSearch} onNavigate={(target, resultQuery) => { setView(target); setSearch(resultQuery); }}/><div className="top-actions"><button className="sync-state" onClick={() => void loadData()} aria-label="Refresh project data"><span className={source === "github" ? "sync-live" : "sync-seed"}/>{source === "github" ? "GitHub live" : "Starter data"}<Icons.refresh/></button><button className="button secondary" onClick={() => setView("intake")}><span className="n8n-button-mark">n8n</span>Workbench intake</button><button className="button secondary" onClick={() => setPublishOpen(true)} disabled={!dirty}><Icons.github/>{dirty ? "Publish changes" : "All changes saved"}</button><button className="button primary" onClick={() => setIntakeOpen(true)}><Icons.plus/>Quick add</button></div></header>

        <div className="content-wrap">
          {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><Icons.close/></button></div>}
          {workflowResult && view !== "intake" && <div className="success-banner"><span>Agent execution {workflowResult.executionId} completed with {workflowResult.proposals.length} proposed change{workflowResult.proposals.length === 1 ? "" : "s"}. Canonical state is unchanged pending review.</span><button onClick={() => setView("review")}>Review proposals</button><button onClick={() => setWorkflowResult(null)} aria-label="Dismiss agent result"><Icons.close/></button></div>}
          <div className="page-heading"><div><span className="eyebrow">{meta.eyebrow}</span><h1 tabIndex={-1}>{meta.title}</h1><p>{meta.description}</p></div><div className="heading-meta"><span>Last synced</span><b>{formatDateTime(data.project.updatedAt)}</b></div></div>

          {view === "intake" && <IntakeWorkbench saving={workflowSaving} result={workflowResult} onRun={(submission) => void runWorkflowIntake(submission)}/>}
          {view === "review" && <ProposalReviewInbox proposalSets={proposalSets} busy={reviewBusy} onSubmit={reviewProposalSet}/>}
          {view === "operations" && <AgentOperationsPanel records={runHistory} busy={workflowSaving} onRecover={(record, mode) => void recoverRun(record, mode)} onUpdate={(record, update) => void updateRun(record, update)}/>}
          {view === "health" && <OperationalHealth runs={runHistory.map((record) => ({ run: record.run }))} pendingReviews={proposalSets.filter((set) => set.status === "pending_review").length}/>}
          {view === "overview" && <Overview data={data} exposure={exposure} openActions={openActions} completedDeliverables={completedDeliverables} setView={setView} onEdit={setEditor} onDelete={requestDelete}/>}
          {view === "plan" && <PlanView data={data} query={query} mutate={mutate} onEdit={setEditor} onDelete={requestDelete}/>}
          {view === "risks" && <RiskView data={data} query={query} onEdit={setEditor} onDelete={requestDelete}/>}
          {view === "registers" && <DomainRegisters data={data} query={query} onEdit={setEditor} onDelete={requestDelete}/>}
          {view === "meetings" && <MeetingView data={data} query={query} onEdit={setEditor} onDelete={requestDelete}/>}
          {view === "steerco" && <SteercoWorkbench pmo={data} workspaceSecret={workspaceSecret}/>}
          {view === "activity" && <ActivityView data={data} storageConfigured={storageConfigured}/>} 
        </div>
      </main>

      {intakeOpen && <UpdateDialog onClose={() => setIntakeOpen(false)} onSubmit={addRecord} workstreams={data.workstreams.map((item) => ({ id: item.id, name: item.shortName }))}/>} 
      {publishOpen && <PublishDialog saving={saving} revision={data.revision} onClose={() => setPublishOpen(false)} onPublish={publish}/>} 
      {editor && <EntityEditor target={editor} data={data} onClose={() => setEditor(null)} onSave={saveEntity}/>}
      {deleteTarget && <DeleteDialog label={deleteTarget.label} blockedReason={deleteTarget.blockedReason} onClose={() => setDeleteTarget(null)} onDelete={() => deleteEntity(deleteTarget)}/>}
      {accessOpen && <AccessDialog loading={loading} error={accessError} onUnlock={(secret) => void loadData(secret)}/>}
    </div>
  );
}

function Overview({ data, exposure, openActions, completedDeliverables, setView, onEdit, onDelete }: { data: PmoDocument; exposure: number; openActions: number; completedDeliverables: number; setView: (view: View) => void; onEdit: (target: EditorTarget) => void; onDelete: (entity: "workstream", id: string, label: string) => void }) {
  const highRisks = [...data.risks].filter((risk) => risk.state !== "closed").sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 3);
  const upcoming = [...data.milestones].filter((item) => item.status !== "complete").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const nextGate = upcoming[0];
  return <>
    <section className="project-hero"><div><div className="hero-top"><RagDot rag={data.project.overallRag}/><span>Revision {data.revision}</span></div><h2>{data.project.name}</h2><p>{data.project.subtitle} - {data.project.phase}</p><button className="hero-edit" onClick={() => onEdit({ entity: "project", id: data.project.id })}><Icons.edit/>Edit project profile</button></div><div className="hero-progress"><div><b>{data.project.progress}%</b><span>overall progress</span></div><ProgressBar value={data.project.progress} tone={data.project.overallRag}/><small>{formatDate(data.project.startDate)} to {formatDate(data.project.endDate)}</small></div></section>
    <section className="metric-grid">
      <article className="metric-card"><span>DELIVERY PROGRESS</span><div><strong>{data.project.progress}%</strong><em className="trend good">+7 pts</em></div><ProgressBar value={data.project.progress}/><small>{completedDeliverables} of {data.deliverables.length} deliverables completed</small></article>
      <article className="metric-card"><span>ACTIVE EXPOSURE</span><div><strong>{exposure}</strong><em className="trend warn">{highRisks.length} high</em></div><div className="mini-bars">{data.risks.map((risk) => <i key={risk.id} style={{ height: `${Math.max(18, riskScore(risk) * 3.3)}%` }} className={riskScore(risk) >= 16 ? "bar-red" : riskScore(risk) >= 10 ? "bar-amber" : "bar-green"}/>)}</div><small>Weighted probability x impact</small></article>
      <article className="metric-card"><span>NEXT GATE</span><div><strong>{nextGate ? formatDate(nextGate.date, true) : "TBC"}</strong><em className="trend warn">{nextGate ? (nextGate.status === "at_risk" ? "At risk" : "On track") : "No gate"}</em></div><b className="metric-title">{nextGate?.title || "No upcoming gate"}</b><small>{nextGate?.owner || "Add a milestone to the plan"}</small></article>
      <article className="metric-card"><span>OPEN ACTIONS</span><div><strong>{openActions}</strong><em className="trend neutral">Across the portfolio</em></div><b className="metric-title">Decision velocity</b><small>{data.decisions.length} decisions captured</small></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel workstream-panel"><div className="panel-head"><div><span className="section-kicker">DELIVERY HEALTH</span><h3>Workstream pulse</h3></div><div className="panel-actions"><button onClick={() => onEdit({ entity: "workstream" })}><Icons.plus/>Add</button><button onClick={() => setView("plan")}>Open plan <Icons.arrow/></button></div></div><div className="workstream-list">{data.workstreams.map((item) => <div className="workstream-row" key={item.id}><span className={`ws-icon ws-${item.id.toLowerCase()}`}>{item.id.slice(2)}</span><div className="ws-copy"><div><b>{item.shortName}</b><span>{item.owner}</span></div><ProgressBar value={item.progress} tone={item.rag}/></div><strong>{item.progress}%</strong><RagDot rag={item.rag} label={false}/><span className="record-actions"><button onClick={() => onEdit({ entity: "workstream", id: item.id })} aria-label={`Edit ${item.shortName}`}><Icons.edit/></button><button onClick={() => onDelete("workstream", item.id, item.shortName)} aria-label={`Delete ${item.shortName}`}><Icons.trash/></button></span></div>)}</div></article>
      <article className="panel milestones-panel"><div className="panel-head"><div><span className="section-kicker">CRITICAL PATH</span><h3>Upcoming gates</h3></div><button onClick={() => setView("plan")}>View all <Icons.arrow/></button></div><div className="milestone-list">{upcoming.map((item, index) => <div className="milestone-row" key={item.id}><div className={cx("date-tile", item.status === "at_risk" && "date-risk")}><b>{datePart(item.date, "day")}</b><span>{datePart(item.date, "month")}</span></div><div><span>{item.id} - {item.phase}</span><b>{item.title}</b><small>{item.description}</small></div>{index === 0 && <StatusPill status={item.status}/>}</div>)}</div></article>
      <article className="panel risk-panel"><div className="panel-head"><div><span className="section-kicker">ATTENTION REQUIRED</span><h3>Top exposure</h3></div><button onClick={() => setView("risks")}>Risk register <Icons.arrow/></button></div><div className="risk-list">{highRisks.map((risk) => <div className="risk-row" key={risk.id}><span className={cx("risk-score", riskScore(risk) >= 16 && "critical")}>{riskScore(risk)}</span><div><b>{risk.title}</b><span>{risk.owner} - {titleCase(risk.state)}</span></div><Icons.chevron/></div>)}</div></article>
      <article className="panel activity-panel"><div className="panel-head"><div><span className="section-kicker">LATEST SIGNALS</span><h3>Live activity</h3></div><button onClick={() => setView("activity")}>Full log <Icons.arrow/></button></div><div className="activity-list compact">{data.audit.slice(0, 4).map((item) => <div className="activity-row" key={item.id}><span className="activity-icon activity-audit">{item.actor.split(" ").map((word) => word[0]).slice(0,2).join("")}</span><div><b>{item.message}</b><span>{item.actor} - {relativeDay(item.timestamp.slice(0, 10), data.project.updatedAt.slice(0, 10))}</span></div></div>)}</div></article>
    </section>
  </>;
}

function PlanView({ data, query, mutate, onEdit, onDelete }: { data: PmoDocument; query: string; mutate: (update: (current: PmoDocument) => PmoDocument) => void; onEdit: (target: EditorTarget) => void; onDelete: (entity: "milestone" | "deliverable", id: string, label: string) => void }) {
  const deliverables = data.deliverables.filter((item) => !query || `${item.title} ${item.owner} ${item.workstream}`.toLowerCase().includes(query));
  function advance(item: Deliverable) {
    const order: Deliverable["status"][] = ["not_started", "in_progress", "at_risk", "blocked", "done"];
    const next = order[Math.min(order.indexOf(item.status) + 1, order.length - 1)];
    mutate((current) => upsertPmoRecord(current, "deliverable", { ...item, status: next, progress: next === "done" ? 100 : item.progress }, "PMO user", new Date().toISOString()));
  }
  return <div className="view-stack">
    <section className="panel"><div className="panel-head"><div><span className="section-kicker">16-WEEK ROADMAP</span><h3>Gate milestones</h3></div><div className="panel-actions"><span className="data-hint">Edit any gate or commitment</span><button onClick={() => onEdit({ entity: "milestone" })}><Icons.plus/>Add milestone</button></div></div><div className="timeline">{data.milestones.map((item, index) => <div className="timeline-item" key={item.id}><button className={cx("timeline-node", item.status === "complete" && "complete", item.status === "at_risk" && "at-risk")} onClick={() => onEdit({ entity: "milestone", id: item.id })} aria-label={`Edit ${item.title}`}>{item.status === "complete" ? <Icons.check/> : index + 1}</button><div><span>{item.id} - {formatDate(item.date)}</span><b>{item.title}</b><small>{item.phase}</small><button className="text-delete" onClick={() => onDelete("milestone", item.id, item.title)}>Delete</button></div></div>)}</div></section>
    <section className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">COMMITMENTS</span><h3>Deliverable register</h3></div><div className="panel-actions"><span className="count-badge">{deliverables.length} items</span><button onClick={() => onEdit({ entity: "deliverable" })}><Icons.plus/>Add deliverable</button></div></div><div className="data-table"><div className="table-row table-head"><span>Deliverable</span><span>Workstream</span><span>Owner</span><span>Due</span><span>Progress</span><span>Status</span><span>Actions</span></div>{deliverables.map((item) => <div className="table-row" key={item.id}><span><small>{item.id} - {item.priority}</small><b>{item.title}</b></span><span>{data.workstreams.find((ws) => ws.id === item.workstream)?.shortName || item.workstream}</span><span>{item.owner}</span><span>{formatDate(item.dueDate, true)}</span><span className="table-progress"><ProgressBar value={item.progress}/><small>{item.progress}%</small></span><button onClick={() => advance(item)} aria-label={`Advance ${item.title}`}><StatusPill status={item.status}/></button><span className="record-actions"><button onClick={() => onEdit({ entity: "deliverable", id: item.id })} aria-label={`Edit ${item.title}`}><Icons.edit/></button><button onClick={() => onDelete("deliverable", item.id, item.title)} aria-label={`Delete ${item.title}`}><Icons.trash/></button></span></div>)}</div></section>
  </div>;
}

function RiskView({ data, query, onEdit, onDelete }: { data: PmoDocument; query: string; onEdit: (target: EditorTarget) => void; onDelete: (entity: "risk", id: string, label: string) => void }) {
  const risks = [...data.risks].filter((item) => !query || `${item.title} ${item.owner} ${item.mitigation}`.toLowerCase().includes(query)).sort((a, b) => riskScore(b) - riskScore(a));
  return <div className="risk-layout"><section className="panel matrix-panel"><div className="panel-head"><div><span className="section-kicker">PROBABILITY X IMPACT</span><h3>Exposure matrix</h3></div></div><div className="risk-matrix"><span className="axis-y">Probability</span>{[5,4,3,2,1].map((probability) => <div className="matrix-row" key={probability}><b>{probability}</b>{[1,2,3,4,5].map((impact) => { const cell = risks.filter((risk) => risk.probability === probability && risk.impact === impact); return <div className={cx("matrix-cell", impact * probability >= 16 ? "matrix-red" : impact * probability >= 10 ? "matrix-amber" : "matrix-green")} key={impact}>{cell.map((risk) => <button key={risk.id} title={risk.title} onClick={() => onEdit({ entity: "risk", id: risk.id })}>{risk.id.replace("R-", "")}</button>)}</div>; })}</div>)}<div className="axis-x"><span/><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><em>Impact</em></div></div></section><section className="panel risk-register"><div className="panel-head"><div><span className="section-kicker">REGISTER</span><h3>Prioritised risks</h3></div><div className="panel-actions"><span className="count-badge">{risks.length} open</span><button onClick={() => onEdit({ entity: "risk" })}><Icons.plus/>Add risk</button></div></div>{risks.map((risk) => <article className="risk-card" key={risk.id}><div className={cx("risk-score", riskScore(risk) >= 16 && "critical")}>{riskScore(risk)}</div><div><div className="risk-card-head"><span>{risk.id}</span><div className="risk-card-tools"><StatusPill status={risk.state}/><button onClick={() => onEdit({ entity: "risk", id: risk.id })} aria-label={`Edit ${risk.title}`}><Icons.edit/></button><button onClick={() => onDelete("risk", risk.id, risk.title)} aria-label={`Delete ${risk.title}`}><Icons.trash/></button></div></div><h4>{risk.title}</h4><p>{risk.description}</p><div className="mitigation"><b>Mitigation</b><span>{risk.mitigation}</span></div><footer><span>{risk.owner}</span><small>Updated {formatDate(risk.updatedAt, true)}</small></footer></div></article>)}</section></div>;
}

function MeetingView({ data, query, onEdit, onDelete }: { data: PmoDocument; query: string; onEdit: (target: EditorTarget) => void; onDelete: (entity: "meeting", id: string, label: string) => void }) {
  const meetings = data.meetings.filter((item) => {
    const decisions = data.decisions.filter((decision) => item.decisionIds.includes(decision.id));
    const actions = data.actions.filter((action) => item.actionIds.includes(action.id));
    return !query || `${item.title} ${item.summary} ${decisions.map((decision) => decision.decision).join(" ")} ${actions.map((action) => action.title).join(" ")}`.toLowerCase().includes(query);
  });
  return <div className="view-stack"><div className="view-toolbar"><div><b>{meetings.length} meeting records</b><span>Maintain summaries and link governed decisions and actions.</span></div><button className="button primary" onClick={() => onEdit({ entity: "meeting" })}><Icons.plus/>Add meeting</button></div><div className="meeting-grid">{meetings.map((meeting) => {
    const decisions = data.decisions.filter((decision) => meeting.decisionIds.includes(decision.id));
    const actions = data.actions.filter((action) => meeting.actionIds.includes(action.id));
    return <article className="panel meeting-card" key={meeting.id}><header><div className="meeting-date"><b>{datePart(meeting.date, "day")}</b><span>{datePart(meeting.date, "month")}</span></div><div><span>{titleCase(meeting.type)}</span><h3>{meeting.title}</h3><small>{meeting.participants.join(" - ")}</small></div><div className="record-actions"><button onClick={() => onEdit({ entity: "meeting", id: meeting.id })} aria-label={`Edit ${meeting.title}`}><Icons.edit/></button><button onClick={() => onDelete("meeting", meeting.id, meeting.title)} aria-label={`Delete ${meeting.title}`}><Icons.trash/></button></div></header><p>{meeting.summary}</p><div className="meeting-evidence"><div><span>DECISIONS</span>{decisions.map((decision) => <p key={decision.id}><Icons.check/>{decision.decision}</p>)}{decisions.length === 0 && <small>No decisions linked.</small>}</div><div><span>ACTIONS</span>{actions.map((action) => <p key={action.id}><i/><span><b>{action.title}</b><small>{action.owner} - {formatDate(action.dueDate, true)}</small></span></p>)}{actions.length === 0 && <small>No actions linked.</small>}</div></div></article>;
  })}</div></div>;
}

function ActivityView({ data, storageConfigured }: { data: PmoDocument; storageConfigured: boolean }) {
  return <div className="activity-layout"><section className="panel"><div className="panel-head"><div><span className="section-kicker">AUDIT TRAIL</span><h3>Project activity</h3></div><span className="count-badge">Revision {data.revision}</span></div><div className="activity-list full">{data.audit.map((item) => <div className="activity-row" key={item.id}><span className="activity-icon activity-audit">{item.actor.split(" ").map((word) => word[0]).slice(0,2).join("")}</span><div><b>{item.message}</b><span>{item.actor} · {item.object.type} {item.object.id}</span></div><time>{formatDateTime(item.timestamp)}</time></div>)}</div></section><aside className="panel integration-panel"><div className="panel-head"><div><span className="section-kicker">PIPELINE</span><h3>Connected systems</h3></div></div><div className="integration"><Icons.github/><div><b>GitHub source of truth</b><span>{storageConfigured ? "Credentials configured" : "Awaiting runtime credentials"}</span></div><i className={storageConfigured ? "healthy" : "pending"}/></div><div className="integration"><span className="n8n-logo">n8n</span><div><b>PMO intake workflow</b><span>Webhook adapter ready</span></div><i className="healthy"/></div><div className="integration"><span className="ai-logo">AI</span><div><b>Canonical normalisation</b><span>n8n agent workflow</span></div><i className="healthy"/></div><p className="integration-note">Every published UI change creates a GitHub revision. Automated intake writes through the same canonical store.</p></aside></div>;
}

function UpdateDialog({ onClose, onSubmit, workstreams }: { onClose: () => void; onSubmit: (type: IntakeType, values: Record<string, string>) => void; workstreams: Array<{ id: string; name: string }> }) {
  const [type, setType] = useState<IntakeType>("risk");
  const [values, setValues] = useState<Record<string, string>>({ title: "", description: "", owner: "", mitigation: "", probability: "3", impact: "3", date: today(), workstream: workstreams[0]?.id || "WS1", participants: "" });
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSubmit(type, values); }}><header><div><span className="section-kicker">QUICK CAPTURE</span><h2>Add project update</h2></div><button type="button" className="icon-button" onClick={onClose}><Icons.close/></button></header><div className="type-switch">{(["risk", "deliverable", "meeting"] as IntakeType[]).map((item) => <button type="button" className={type === item ? "active" : ""} onClick={() => setType(item)} key={item}>{titleCase(item)}</button>)}</div><label><span>Title</span><input required value={values.title} onChange={(event) => set("title", event.target.value)} placeholder={`New ${type} title`}/></label><div className="form-row"><label><span>Owner</span><input required value={values.owner} onChange={(event) => set("owner", event.target.value)} placeholder="Role or name"/></label>{type !== "risk" && <label><span>{type === "meeting" ? "Meeting date" : "Due date"}</span><input type="date" required value={values.date} onChange={(event) => set("date", event.target.value)}/></label>}</div>{type === "risk" && <><div className="form-row"><label><span>Probability</span><select value={values.probability} onChange={(event) => set("probability", event.target.value)}>{[1,2,3,4,5].map((n) => <option key={n}>{n}</option>)}</select></label><label><span>Impact</span><select value={values.impact} onChange={(event) => set("impact", event.target.value)}>{[1,2,3,4,5].map((n) => <option key={n}>{n}</option>)}</select></label></div><label><span>Mitigation</span><textarea required value={values.mitigation} onChange={(event) => set("mitigation", event.target.value)} placeholder="How will this exposure be reduced?"/></label></>}{type === "deliverable" && <label><span>Workstream</span><select value={values.workstream} onChange={(event) => set("workstream", event.target.value)}>{workstreams.map((item) => <option value={item.id} key={item.id}>{item.id} - {item.name}</option>)}</select></label>}{type === "meeting" && <label><span>Participants</span><input value={values.participants} onChange={(event) => set("participants", event.target.value)} placeholder="Comma-separated roles or names"/></label>}<label><span>{type === "meeting" ? "Summary" : "Description"}</span><textarea required value={values.description} onChange={(event) => set("description", event.target.value)} placeholder="Add concise, decision-useful context"/></label><footer><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary"><Icons.plus/>Add to workspace</button></footer></form></div>;
}

function PublishDialog({ saving, revision, onClose, onPublish }: { saving: boolean; revision: number; onClose: () => void; onPublish: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal publish-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void onPublish(); }}><header><div><span className="section-kicker">GITHUB PUBLISH</span><h2>Create revision {revision + 1}</h2></div><button type="button" className="icon-button" onClick={onClose}><Icons.close/></button></header><div className="publish-summary"><Icons.github/><div><b>knowledge/pmo/control-tower.json</b><span>Validated by the protected workflow and committed to the private data repository.</span></div></div><p>The temporary workspace credential remains in memory for this browser session and is sent only to the configured protected endpoint.</p><footer><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Publishing..." : "Publish to GitHub"}</button></footer></form></div>;
}

function AccessDialog({ loading, error, onUnlock }: { loading: boolean; error: string; onUnlock: (secret: string) => void }) {
  const [secret, setSecret] = useState("");
  return <div className="modal-backdrop"><form className="modal publish-modal" onSubmit={(event) => { event.preventDefault(); onUnlock(secret); }}><header><div><span className="section-kicker">MVP ACCESS</span><h2>Open the Transformation Cockpit</h2></div></header><p>The frontend and policy API are prepared for independent Azure App Service deployments. Microsoft Entra authentication replaces this temporary bootstrap seam in the identity slice.</p>{error && <div className="error-banner" role="alert"><span>{error}</span></div>}<label><span>Temporary workspace credential</span><input type="password" autoFocus required value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password"/><small>Kept in memory only. Refreshing or closing the page clears it.</small></label><footer><button className="button primary" disabled={loading}>{loading ? "Connecting..." : "Open workspace"}</button></footer></form></div>;
}
