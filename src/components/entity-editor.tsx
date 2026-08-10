"use client";

import { useState } from "react";
import { Icons } from "./icons";
import type { PmoDocument } from "@/lib/pmo-schema";

export type EditableEntity =
  | "project" | "workstream" | "milestone" | "deliverable" | "risk" | "issue"
  | "action" | "decision" | "dependency" | "assumption" | "change_request" | "meeting";
export type EditorTarget = { entity: EditableEntity; id?: string };

type Props = {
  target: EditorTarget;
  data: PmoDocument;
  onClose: () => void;
  onSave: (target: EditorTarget, values: Record<string, string>) => void;
};

const labels: Record<EditableEntity, string> = {
  project: "project profile", workstream: "workstream", milestone: "milestone",
  deliverable: "deliverable", risk: "risk", issue: "issue", action: "action",
  decision: "decision", dependency: "dependency", assumption: "assumption",
  change_request: "change request", meeting: "meeting record",
};

const csv = (values: string[]) => values.join(", ");
const splitCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

function findRecord(target: EditorTarget, data: PmoDocument) {
  const map = {
    workstream: data.workstreams, milestone: data.milestones, deliverable: data.deliverables,
    risk: data.risks, issue: data.issues, action: data.actions, decision: data.decisions,
    dependency: data.dependencies, assumption: data.assumptions, change_request: data.changeRequests,
    meeting: data.meetings,
  };
  return target.entity === "project" ? data.project : map[target.entity].find((item) => item.id === target.id);
}

function initialValues(target: EditorTarget, data: PmoDocument): Record<string, string> {
  const record = findRecord(target, data) as Record<string, unknown> | undefined;
  const evidenceIds = record && "governance" in record
    ? csv((record.governance as { evidenceIds: string[] }).evidenceIds)
    : "";

  if (target.entity === "project") return { ...Object.fromEntries(["name", "subtitle", "phase", "startDate", "endDate", "overallRag", "progress"].map((key) => [key, String(record?.[key] ?? "")])), evidenceIds };
  if (target.entity === "workstream") return { name: String(record?.name ?? ""), shortName: String(record?.shortName ?? ""), owner: String(record?.owner ?? ""), progress: String(record?.progress ?? 0), rag: String(record?.rag ?? "grey"), evidenceIds };
  if (target.entity === "milestone") return { title: String(record?.title ?? ""), phase: String(record?.phase ?? data.project.phase), date: String(record?.date ?? data.project.endDate), status: String(record?.status ?? "upcoming"), owner: String(record?.owner ?? ""), description: String(record?.description ?? ""), evidenceIds };
  if (target.entity === "deliverable") return { title: String(record?.title ?? ""), workstream: String(record?.workstream ?? data.workstreams[0]?.id ?? "WS-1"), dueDate: String(record?.dueDate ?? data.project.endDate), status: String(record?.status ?? "not_started"), owner: String(record?.owner ?? ""), progress: String(record?.progress ?? 0), priority: String(record?.priority ?? "P2"), evidenceIds };
  if (target.entity === "risk") return { title: String(record?.title ?? ""), description: String(record?.description ?? ""), probability: String(record?.probability ?? 3), impact: String(record?.impact ?? 3), state: String(record?.state ?? "open"), owner: String(record?.owner ?? ""), mitigation: String(record?.mitigation ?? ""), evidenceIds };
  if (target.entity === "issue") return { title: String(record?.title ?? ""), description: String(record?.description ?? ""), owner: String(record?.owner ?? ""), status: String(record?.status ?? "open"), priority: String(record?.priority ?? "P2"), severity: String(record?.severity ?? 3), raisedAt: String(record?.raisedAt ?? new Date().toISOString().slice(0, 10)), dueDate: String(record?.dueDate ?? ""), resolution: String(record?.resolution ?? ""), workstreamId: String(record?.workstreamId ?? ""), relatedRiskIds: csv((record?.relatedRiskIds as string[] | undefined) ?? []), evidenceIds };
  if (target.entity === "action") return { title: String(record?.title ?? ""), description: String(record?.description ?? ""), owner: String(record?.owner ?? ""), status: String(record?.status ?? "open"), priority: String(record?.priority ?? "P2"), dueDate: String(record?.dueDate ?? data.project.endDate), evidenceIds };
  if (target.entity === "decision") return { title: String(record?.title ?? ""), context: String(record?.context ?? ""), decision: String(record?.decision ?? ""), owner: String(record?.owner ?? ""), status: String(record?.status ?? "proposed"), decisionDate: String(record?.decisionDate ?? new Date().toISOString().slice(0, 10)), approver: String(record?.approver ?? ""), effectiveDate: String(record?.effectiveDate ?? ""), impact: String(record?.impact ?? ""), evidenceIds };
  if (target.entity === "dependency") return { title: String(record?.title ?? ""), description: String(record?.description ?? ""), owner: String(record?.owner ?? ""), provider: String(record?.provider ?? ""), type: String(record?.type ?? "internal"), direction: String(record?.direction ?? "inbound"), status: String(record?.status ?? "open"), criticality: String(record?.criticality ?? "medium"), neededBy: String(record?.neededBy ?? data.project.endDate), evidenceIds };
  if (target.entity === "assumption") return { title: String(record?.title ?? ""), statement: String(record?.statement ?? ""), owner: String(record?.owner ?? ""), status: String(record?.status ?? "active"), criticality: String(record?.criticality ?? "medium"), validationDueDate: String(record?.validationDueDate ?? data.project.endDate), validationMethod: String(record?.validationMethod ?? ""), impactIfFalse: String(record?.impactIfFalse ?? ""), evidenceIds };
  if (target.entity === "change_request") return { title: String(record?.title ?? ""), description: String(record?.description ?? ""), requester: String(record?.requester ?? ""), owner: String(record?.owner ?? ""), status: String(record?.status ?? "draft"), priority: String(record?.priority ?? "P2"), submittedAt: String(record?.submittedAt ?? new Date().toISOString().slice(0, 10)), decisionDueDate: String(record?.decisionDueDate ?? ""), scopeImpact: String(record?.scopeImpact ?? ""), scheduleImpact: String(record?.scheduleImpact ?? ""), costImpact: String(record?.costImpact ?? ""), benefitImpact: String(record?.benefitImpact ?? ""), riskImpact: String(record?.riskImpact ?? ""), decisionId: String(record?.decisionId ?? ""), evidenceIds };
  return { title: String(record?.title ?? ""), date: String(record?.date ?? data.project.endDate), type: String(record?.type ?? "working_session"), participants: csv((record?.participants as string[] | undefined) ?? []), summary: String(record?.summary ?? ""), decisionIds: csv((record?.decisionIds as string[] | undefined) ?? []), actionIds: csv((record?.actionIds as string[] | undefined) ?? []), evidenceIds };
}

function Field({ label, name, values, set, type = "text", required = true }: { label: string; name: string; values: Record<string, string>; set: (name: string, value: string) => void; type?: string; required?: boolean }) {
  return <label><span>{label}</span><input type={type} required={required} value={values[name] ?? ""} onChange={(event) => set(name, event.target.value)}/></label>;
}
function SelectField({ label, name, values, set, options }: { label: string; name: string; values: Record<string, string>; set: (name: string, value: string) => void; options: string[] }) {
  return <label><span>{label}</span><select value={values[name] ?? ""} onChange={(event) => set(name, event.target.value)}>{options.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>;
}
function TextAreaField({ label, name, values, set, required = true }: { label: string; name: string; values: Record<string, string>; set: (name: string, value: string) => void; required?: boolean }) {
  return <label><span>{label}</span><textarea required={required} value={values[name] ?? ""} onChange={(event) => set(name, event.target.value)}/></label>;
}
function Pair({ children }: { children: React.ReactNode }) { return <div className="form-row">{children}</div>; }

export function EntityEditor({ target, data, onClose, onSave }: Props) {
  const [values, setValues] = useState(() => initialValues(target, data));
  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const record = findRecord(target, data) as { governance?: { version: number; reviewStatus: string } } | undefined;
  const isNew = !target.id && target.entity !== "project";
  const score = ["1", "2", "3", "4", "5"];
  const priority = ["P1", "P2", "P3"];
  const criticality = ["low", "medium", "high", "critical"];

  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal entity-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSave(target, values); }}>
    <header><div><span className="section-kicker">{isNew ? "CREATE" : "EDIT"}</span><h2>{isNew ? "Add" : "Update"} {labels[target.entity]}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close editor"><Icons.close/></button></header>
    <div className="entity-form">
      {!isNew && <div className="governance-strip"><span>Object version <b>{record?.governance?.version ?? 1}</b></span><span>Review <b>{record?.governance?.reviewStatus?.replaceAll("_", " ") ?? "not requested"}</b></span></div>}
      {target.entity === "project" && <><Field label="Project name" name="name" values={values} set={set}/><Field label="Subtitle" name="subtitle" values={values} set={set}/><Pair><Field label="Phase" name="phase" values={values} set={set}/><SelectField label="Overall RAG" name="overallRag" values={values} set={set} options={["green", "amber", "red", "grey"]}/></Pair><Pair><Field label="Start date" name="startDate" type="date" values={values} set={set}/><Field label="End date" name="endDate" type="date" values={values} set={set}/></Pair><Field label="Progress (%)" name="progress" type="number" values={values} set={set}/></>}
      {target.entity === "workstream" && <><Field label="Name" name="name" values={values} set={set}/><Pair><Field label="Short name" name="shortName" values={values} set={set}/><Field label="Owner" name="owner" values={values} set={set}/></Pair><Pair><Field label="Progress (%)" name="progress" type="number" values={values} set={set}/><SelectField label="RAG" name="rag" values={values} set={set} options={["green", "amber", "red", "grey"]}/></Pair></>}
      {target.entity === "milestone" && <><Field label="Title" name="title" values={values} set={set}/><Pair><Field label="Phase" name="phase" values={values} set={set}/><Field label="Date" name="date" type="date" values={values} set={set}/></Pair><Pair><Field label="Owner" name="owner" values={values} set={set}/><SelectField label="Status" name="status" values={values} set={set} options={["upcoming", "at_risk", "complete"]}/></Pair><TextAreaField label="Description" name="description" values={values} set={set}/></>}
      {target.entity === "deliverable" && <><Field label="Title" name="title" values={values} set={set}/><Pair><SelectField label="Workstream" name="workstream" values={values} set={set} options={data.workstreams.map((item) => item.id)}/><Field label="Owner" name="owner" values={values} set={set}/></Pair><Pair><Field label="Due date" name="dueDate" type="date" values={values} set={set}/><SelectField label="Priority" name="priority" values={values} set={set} options={priority}/></Pair><Pair><Field label="Progress (%)" name="progress" type="number" values={values} set={set}/><SelectField label="Status" name="status" values={values} set={set} options={["not_started", "in_progress", "at_risk", "blocked", "done"]}/></Pair></>}
      {target.entity === "risk" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Description" name="description" values={values} set={set}/><Pair><SelectField label="Probability" name="probability" values={values} set={set} options={score}/><SelectField label="Impact" name="impact" values={values} set={set} options={score}/></Pair><Pair><Field label="Owner" name="owner" values={values} set={set}/><SelectField label="State" name="state" values={values} set={set} options={["open", "mitigating", "monitoring", "closed"]}/></Pair><TextAreaField label="Mitigation" name="mitigation" values={values} set={set}/></>}
      {target.entity === "issue" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Description" name="description" values={values} set={set}/><Pair><Field label="Owner" name="owner" values={values} set={set}/><SelectField label="Status" name="status" values={values} set={set} options={["open", "in_progress", "resolved", "closed"]}/></Pair><Pair><SelectField label="Priority" name="priority" values={values} set={set} options={priority}/><SelectField label="Severity" name="severity" values={values} set={set} options={score}/></Pair><Pair><Field label="Raised" name="raisedAt" type="date" values={values} set={set}/><Field label="Due date" name="dueDate" type="date" values={values} set={set} required={false}/></Pair><Pair><Field label="Workstream ID" name="workstreamId" values={values} set={set} required={false}/><Field label="Related risk IDs" name="relatedRiskIds" values={values} set={set} required={false}/></Pair><TextAreaField label="Resolution" name="resolution" values={values} set={set} required={false}/></>}
      {target.entity === "action" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Description" name="description" values={values} set={set} required={false}/><Pair><Field label="Owner" name="owner" values={values} set={set}/><Field label="Due date" name="dueDate" type="date" values={values} set={set}/></Pair><Pair><SelectField label="Priority" name="priority" values={values} set={set} options={priority}/><SelectField label="Status" name="status" values={values} set={set} options={["open", "in_progress", "blocked", "done", "cancelled"]}/></Pair></>}
      {target.entity === "decision" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Context" name="context" values={values} set={set}/><TextAreaField label="Decision" name="decision" values={values} set={set}/><Pair><Field label="Owner" name="owner" values={values} set={set}/><SelectField label="Status" name="status" values={values} set={set} options={["proposed", "approved", "rejected", "superseded"]}/></Pair><Pair><Field label="Decision date" name="decisionDate" type="date" values={values} set={set}/><Field label="Effective date" name="effectiveDate" type="date" values={values} set={set} required={false}/></Pair><Field label="Approver" name="approver" values={values} set={set} required={false}/><TextAreaField label="Impact" name="impact" values={values} set={set} required={false}/></>}
      {target.entity === "dependency" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Description" name="description" values={values} set={set}/><Pair><Field label="Owner" name="owner" values={values} set={set}/><Field label="Provider" name="provider" values={values} set={set}/></Pair><Pair><SelectField label="Type" name="type" values={values} set={set} options={["internal", "external"]}/><SelectField label="Direction" name="direction" values={values} set={set} options={["inbound", "outbound", "mutual"]}/></Pair><Pair><SelectField label="Status" name="status" values={values} set={set} options={["open", "confirmed", "at_risk", "blocked", "satisfied", "cancelled"]}/><SelectField label="Criticality" name="criticality" values={values} set={set} options={criticality}/></Pair><Field label="Needed by" name="neededBy" type="date" values={values} set={set}/></>}
      {target.entity === "assumption" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Statement" name="statement" values={values} set={set}/><Pair><Field label="Owner" name="owner" values={values} set={set}/><SelectField label="Status" name="status" values={values} set={set} options={["active", "validated", "invalidated", "retired"]}/></Pair><Pair><SelectField label="Criticality" name="criticality" values={values} set={set} options={criticality}/><Field label="Validation due" name="validationDueDate" type="date" values={values} set={set}/></Pair><TextAreaField label="Validation method" name="validationMethod" values={values} set={set}/><TextAreaField label="Impact if false" name="impactIfFalse" values={values} set={set}/></>}
      {target.entity === "change_request" && <><Field label="Title" name="title" values={values} set={set}/><TextAreaField label="Description" name="description" values={values} set={set}/><Pair><Field label="Requester" name="requester" values={values} set={set}/><Field label="Owner" name="owner" values={values} set={set}/></Pair><Pair><SelectField label="Status" name="status" values={values} set={set} options={["draft", "submitted", "under_review", "approved", "rejected", "implemented", "withdrawn"]}/><SelectField label="Priority" name="priority" values={values} set={set} options={priority}/></Pair><Pair><Field label="Submitted" name="submittedAt" type="date" values={values} set={set}/><Field label="Decision due" name="decisionDueDate" type="date" values={values} set={set} required={false}/></Pair><TextAreaField label="Scope impact" name="scopeImpact" values={values} set={set} required={false}/><TextAreaField label="Schedule impact" name="scheduleImpact" values={values} set={set} required={false}/><Pair><Field label="Cost impact" name="costImpact" values={values} set={set} required={false}/><Field label="Benefit impact" name="benefitImpact" values={values} set={set} required={false}/></Pair><TextAreaField label="Risk impact" name="riskImpact" values={values} set={set} required={false}/><Field label="Decision ID" name="decisionId" values={values} set={set} required={false}/></>}
      {target.entity === "meeting" && <><Field label="Title" name="title" values={values} set={set}/><Pair><Field label="Date" name="date" type="date" values={values} set={set}/><SelectField label="Type" name="type" values={values} set={set} options={["steering", "working_session", "workstream", "decision"]}/></Pair><Field label="Participants" name="participants" values={values} set={set}/><TextAreaField label="Summary" name="summary" values={values} set={set}/><Pair><Field label="Decision IDs" name="decisionIds" values={values} set={set} required={false}/><Field label="Action IDs" name="actionIds" values={values} set={set} required={false}/></Pair></>}
      <Field label="Evidence IDs" name="evidenceIds" values={values} set={set} required={false}/>
      <small className="field-help">Comma-separated references to verified evidence records. Reviews are managed through the governance register.</small>
    </div>
    <footer><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary">{isNew ? <Icons.plus/> : <Icons.check/>}{isNew ? "Add to workbench" : "Apply changes"}</button></footer>
  </form></div>;
}

export { splitCsv };

export function DeleteDialog({ label, blockedReason, onClose, onDelete }: { label: string; blockedReason?: string; onClose: () => void; onDelete: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal publish-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="section-kicker danger-kicker">DELETE</span><h2>{blockedReason ? "Resolve linked records first" : "Remove this record?"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close delete confirmation"><Icons.close/></button></header><p>{blockedReason ? <><b>{label}</b> cannot be removed yet. {blockedReason}</> : <><b>{label}</b> will be removed from the workbench. The deletion becomes permanent after publishing the next revision.</>}</p><footer><button type="button" className="button ghost" onClick={onClose}>{blockedReason ? "Close" : "Keep record"}</button><button type="button" className="button danger" disabled={Boolean(blockedReason)} onClick={onDelete}><Icons.trash/>{blockedReason ? "Dependencies remain" : "Delete record"}</button></footer></div></div>;
}
