"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "./icons";
import type { EditableEntity, EditorTarget } from "./entity-editor";
import type { PmoDocument } from "@/lib/pmo-schema";
import { applyBulkUpdate, applyImportPreview, deliveryRecordOwner, deliveryRelationships, deliveryTimeline, exportRegisterCsv, filterAndSortDeliveryRecords, onboardingChecklist, previewBulkUpdate, previewCsvImport, PROJECT_DELIVERY_WORKBENCH_VERSION, PROJECT_TEMPLATES, type BulkUpdatePreview, type DeliverySavedView, type DeliverySort, type ImportPreview } from "@/lib/project-delivery-workbench";

type RegisterType = "issue" | "action" | "decision" | "dependency" | "assumption" | "change_request" | "governance";
type DeletableRegisterType = Exclude<RegisterType, "governance">;
type RegisterColumn = "owner" | "date" | "version" | "evidence";
const columnLabels: Record<RegisterColumn, string> = { owner: "Owner", date: "Control date", version: "Version", evidence: "Evidence" };
const COLUMN_STORAGE_KEY = "transformation-cockpit:register-columns";
const VIEW_STORAGE_KEY = "transformation-cockpit:register-saved-views";
const statusOptions: Record<DeletableRegisterType, string[]> = { issue: ["open", "in_progress", "resolved", "closed"], action: ["open", "in_progress", "blocked", "done", "cancelled"], decision: ["proposed", "approved", "rejected", "superseded"], dependency: ["identified", "active", "at_risk", "resolved"], assumption: ["active", "validated", "invalidated", "retired"], change_request: ["draft", "submitted", "under_review", "approved", "rejected", "implemented", "withdrawn"] };

const labels: Record<RegisterType, string> = {
  issue: "Issues", action: "Actions", decision: "Decisions", dependency: "Dependencies",
  assumption: "Assumptions", change_request: "Change requests", governance: "Evidence & governance",
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusOf(record: Record<string, unknown>) {
  return String(record.status ?? record.governance ?? "recorded");
}

function dueOf(type: DeletableRegisterType, record: Record<string, unknown>) {
  const field = type === "issue" ? "dueDate"
    : type === "action" ? "dueDate"
      : type === "decision" ? "decisionDate"
        : type === "dependency" ? "neededBy"
          : type === "assumption" ? "validationDueDate"
            : "decisionDueDate";
  return record[field] ? String(record[field]) : "No due date";
}

export function DomainRegisters({ data, query, onEdit, onDelete, onApply }: {
  data: PmoDocument;
  query: string;
  onEdit: (target: EditorTarget) => void;
  onDelete: (entity: Exclude<EditableEntity, "project">, id: string, label: string) => void;
  onApply: (next: PmoDocument) => void;
}) {
  const [active, setActive] = useState<RegisterType>("issue");
  const [columns, setColumns] = useState<RegisterColumn[]>(() => {
    if (typeof window === "undefined") return ["owner", "date", "version", "evidence"];
    try {
      const stored = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || "[]") as RegisterColumn[];
      const valid = stored.filter((item) => item in columnLabels);
      return valid.length ? valid : ["owner", "date", "version", "evidence"];
    } catch { return ["owner", "date", "version", "evidence"]; }
  });
  const [registerQuery, setRegisterQuery] = useState(""); const [owner, setOwner] = useState("all"); const [status, setStatus] = useState("all"); const [sort, setSort] = useState<DeliverySort>("control_date"); const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [savedViews, setSavedViews] = useState<DeliverySavedView[]>(() => { try { return JSON.parse(typeof window === "undefined" ? "[]" : localStorage.getItem(VIEW_STORAGE_KEY) || "[]"); } catch { return []; } });
  const [selected, setSelected] = useState<string[]>([]); const [bulkOwner, setBulkOwner] = useState(""); const [bulkStatus, setBulkStatus] = useState(""); const [bulkPreview, setBulkPreview] = useState<BulkUpdatePreview | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null); const [toolError, setToolError] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || "[]") as RegisterColumn[];
        const valid = stored.filter((item) => item in columnLabels);
        if (valid.length) setColumns(valid);
      } catch { /* Keep the accessible default columns. */ }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function toggleColumn(column: RegisterColumn) {
    const next = columns.includes(column) ? columns.filter((item) => item !== column) : [...columns, column];
    if (!next.length) return;
    setColumns(next); localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next));
  }
  const records: Record<DeletableRegisterType, Array<Record<string, unknown> & { id: string; title: string }>> = {
    issue: data.issues,
    action: data.actions,
    decision: data.decisions,
    dependency: data.dependencies,
    assumption: data.assumptions,
    change_request: data.changeRequests,
  };
  const filtered = useMemo(() => active === "governance" ? [] : filterAndSortDeliveryRecords(data, { register: active, query: `${query} ${registerQuery}`.trim(), owner, status, sort, direction }), [active, data, direction, owner, query, registerQuery, sort, status]);
  const availableOwners = active === "governance" ? [] : [...new Set(records[active].map(deliveryRecordOwner))].sort();
  function changeRegister(type: RegisterType) { setActive(type); setSelected([]); setBulkPreview(null); setImportPreview(null); setOwner("all"); setStatus("all"); }
  function saveView() { if (active === "governance") return; const name = window.prompt("Saved view name")?.trim(); if (!name) return; const next = [...savedViews.filter((item) => item.name !== name), { contractVersion: PROJECT_DELIVERY_WORKBENCH_VERSION, id: `view-${Date.now()}`, name, register: active, query: registerQuery, owner, status, sort, direction }]; setSavedViews(next); localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(next)); }
  function loadView(id: string) { const view = savedViews.find((item) => item.id === id); if (!view) return; setActive(view.register); setRegisterQuery(view.query); setOwner(view.owner); setStatus(view.status); setSort(view.sort); setDirection(view.direction); setSelected([]); }
  function inspectBulk() { if (active === "governance") return; setToolError(""); try { setBulkPreview(previewBulkUpdate(data, active, selected, { owner: bulkOwner, status: bulkStatus })); } catch (reason) { setToolError(reason instanceof Error ? reason.message : "Bulk preview failed."); } }
  function commitBulk() { if (!bulkPreview) return; setToolError(""); try { onApply(applyBulkUpdate(data, bulkPreview, "PMO user")); setSelected([]); setBulkPreview(null); setBulkOwner(""); setBulkStatus(""); } catch (reason) { setToolError(reason instanceof Error ? reason.message : "Bulk update failed."); } }
  function downloadCsv() { if (active === "governance") return; const blob = new Blob([exportRegisterCsv(data, active)], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${active}-register-revision-${data.revision}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  async function inspectImport(file: File | undefined) { if (!file || active === "governance") return; setToolError(""); try { let text = await file.text(); if (file.name.toLowerCase().endsWith(".xlsx")) { const { readSheet } = await import("read-excel-file/browser"); const rows = await readSheet(file); const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; text = rows.map((row) => row.map(quote).join(",")).join("\n"); } setImportPreview(previewCsvImport(active, text)); } catch (reason) { setToolError(reason instanceof Error ? reason.message : "Import preview failed."); } }
  function commitImport() { if (!importPreview) return; setToolError(""); try { onApply(applyImportPreview(data, importPreview, "PMO user")); setImportPreview(null); } catch (reason) { setToolError(reason instanceof Error ? reason.message : "Import failed."); } }

  return <div className="register-workbench">
    <section className="panel register-summary">
      <div><span className="section-kicker">CONTROLLED PMO DOMAIN</span><h2>Governed registers</h2><p>Manage traceable issues, commitments, decisions, dependencies, assumptions and controlled change as versioned first-class records.</p></div>
      <div className="register-kpis">
        <span><b>{data.issues.filter((item) => !["resolved", "closed"].includes(item.status)).length}</b> open issues</span>
        <span><b>{data.actions.filter((item) => !["done", "cancelled"].includes(item.status)).length}</b> open actions</span>
        <span><b>{data.reviews.filter((item) => item.status === "pending").length}</b> pending reviews</span>
        <span><b>{data.evidence.filter((item) => item.status === "verified").length}</b> verified evidence</span>
      </div>
    </section>

    <div className="register-tabs" role="tablist" aria-label="PMO registers">
      {(Object.keys(labels) as RegisterType[]).map((type) => <button role="tab" aria-selected={active === type} className={active === type ? "active" : ""} onClick={() => changeRegister(type)} key={type}>{labels[type]}</button>)}
    </div>

    {active !== "governance" && <section className="panel register-panel">
      <header className="panel-heading"><div><span className="section-kicker">{active.replaceAll("_", " ").toUpperCase()}</span><h3>{labels[active]}</h3></div><div className="register-toolbar"><select aria-label="Saved register view" defaultValue="" onChange={(event) => loadView(event.target.value)}><option value="">Saved views</option>{savedViews.map((view) => <option value={view.id} key={view.id}>{view.name}</option>)}</select><button className="button ghost" onClick={saveView}>Save view</button><details><summary>Columns ({columns.length})</summary><fieldset><legend>Visible record fields</legend>{(Object.keys(columnLabels) as RegisterColumn[]).map((column) => <label key={column}><input type="checkbox" checked={columns.includes(column)} onChange={() => toggleColumn(column)}/>{columnLabels[column]}</label>)}</fieldset></details><button className="button primary" onClick={() => onEdit({ entity: active })}><Icons.plus/>Add {labels[active].slice(0, -1).toLowerCase()}</button></div></header>
      <div className="register-controls"><label><span>Filter records</span><input value={registerQuery} onChange={(event) => setRegisterQuery(event.target.value)} placeholder="Title, id or evidence" /></label><label><span>Owner</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All owners</option>{availableOwners.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statusOptions[active].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label><label><span>Sort</span><select aria-label="Sort register records" value={sort} onChange={(event) => setSort(event.target.value as DeliverySort)}><option value="control_date">Control date</option><option value="title">Title</option><option value="owner">Owner</option><option value="status">Status</option><option value="version">Object version</option></select></label><button className="button ghost" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}>{direction === "asc" ? "Ascending" : "Descending"}</button></div>
      <div className="register-bulk"><b>{selected.length} selected</b><label><span>New owner</span><input value={bulkOwner} onChange={(event) => setBulkOwner(event.target.value)} placeholder="Keep current" /></label><label><span>New status</span><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">Keep current</option>{statusOptions[active].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label><button className="button secondary" disabled={!selected.length} onClick={inspectBulk}>Preview bulk update</button><label className="register-import"><span>Import CSV / Excel</span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void inspectImport(event.target.files?.[0])} /></label><button className="button ghost" onClick={downloadCsv}>Export governed CSV</button></div>
      {toolError && <div className="error-banner" role="alert">{toolError}</div>}{bulkPreview && <div className="register-preview" role="status"><b>Bulk preview · {bulkPreview.changes.length} version-checked change(s)</b>{bulkPreview.changes.map((change) => <span key={change.id}>{change.id} · v{String(change.from.version)} → v{String(change.to.version)} · {String(change.from.owner)} / {String(change.from.status)} → {String(change.to.owner)} / {String(change.to.status)}</span>)}<button className="button primary" onClick={commitBulk}>Apply governed bulk update</button></div>}{importPreview && <div className="register-preview" role="status"><b>Import preview · {importPreview.rows.length} row(s)</b>{importPreview.errors.map((item) => <span className="import-error" key={item}>{item}</span>)}{importPreview.rows.slice(0, 5).map((row) => <span key={row.id}>{row.id} · v{row.object_version} · {row.title} · {row.owner} · {row.status}</span>)}<button className="button primary" disabled={Boolean(importPreview.errors.length)} onClick={commitImport}>Apply governed import</button></div>}
      <div className="register-grid">{filtered.map((item) => {
        const record = item as Record<string, unknown> & { id: string; title: string; governance: { version: number; reviewStatus: string; evidenceIds: string[] } };
        return <article className="register-card" key={record.id}>
          <header><label className="register-select"><input type="checkbox" aria-label={`Select ${record.title}`} checked={selected.includes(record.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, record.id] : selected.filter((id) => id !== record.id))}/><span>{record.id}</span></label><span className={`status-pill status-${["approved", "resolved", "done", "implemented", "validated"].includes(statusOf(record)) ? "success" : "neutral"}`}>{titleCase(statusOf(record))}</span></header>
          <h4>{record.title}</h4>
          <p>{String(record.description ?? record.statement ?? record.context ?? record.decision ?? "")}</p>
          <div className="register-meta" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>{columns.includes("owner") && <span><b>Owner</b>{String(record.owner ?? record.requester ?? "Unassigned")}</span>}{columns.includes("date") && <span><b>Control date</b>{dueOf(active, record)}</span>}{columns.includes("version") && <span><b>Version</b>{record.governance.version}</span>}{columns.includes("evidence") && <span><b>Evidence</b>{record.governance.evidenceIds.length}</span>}</div>
          <footer><span>Review: {titleCase(record.governance.reviewStatus)}</span><div className="record-actions"><button onClick={() => onEdit({ entity: active, id: record.id })} aria-label={`Edit ${record.title}`}><Icons.edit/></button><button onClick={() => onDelete(active, record.id, record.title)} aria-label={`Delete ${record.title}`}><Icons.trash/></button></div></footer>
        </article>;
      })}{filtered.length === 0 && <div className="empty-state">No {labels[active].toLowerCase()} match the current filter.</div>}</div>
    </section>}

    <DeliveryIntelligence data={data}/>

    {active === "governance" && <GovernanceRegister data={data}/>}
  </div>;
}

function DeliveryIntelligence({ data }: { data: PmoDocument }) {
  const relationships = deliveryRelationships(data); const timeline = deliveryTimeline(data); const onboarding = onboardingChecklist(data);
  return <section className="delivery-intelligence" aria-label="Delivery intelligence">
    <article className="panel"><header><span className="section-kicker">ONBOARDING</span><h3>Recoverable project checklist</h3></header><div className="onboarding-progress"><b>{onboarding.filter((item) => item.complete).length}/{onboarding.length}</b><span>Derived from governed project state · template {PROJECT_TEMPLATES[0].version}</span></div>{onboarding.map((item) => <p key={item.id} className={item.complete ? "complete" : ""}><span aria-hidden="true">{item.complete ? "✓" : "○"}</span>{item.label}</p>)}<small>{PROJECT_TEMPLATES[0].name}: {PROJECT_TEMPLATES[0].description}</small></article>
    <article className="panel"><header><span className="section-kicker">TIMELINE</span><h3>Milestones and critical path</h3></header><p className="critical-explanation">{timeline.explanation}</p>{timeline.milestones.map((item) => <div className={item.critical ? "critical" : ""} key={item.id}><time>{item.date}</time><b>{item.title}</b><span>{titleCase(item.status)} · {item.owner}{item.critical ? " · critical path" : ""}</span></div>)}</article>
    <article className="panel delivery-relationships"><header><span className="section-kicker">RELATIONSHIPS</span><h3>Cross-object control map</h3></header>{relationships.slice(0, 14).map((item, index) => <div key={`${item.source.type}:${item.source.id}:${item.target.type}:${item.target.id}:${index}`}><code>{item.source.type}:{item.source.id}</code><span>{item.relation}</span><code>{item.target.type}:{item.target.id}</code></div>)}{!relationships.length && <p>No explicit cross-object relationships are recorded.</p>}<small>{relationships.length} source-linked relationship(s). Evidence and governance remain available in the dedicated register.</small></article>
  </section>;
}

function GovernanceRegister({ data }: { data: PmoDocument }) {
  return <div className="governance-register">
    <section className="panel"><header><span className="section-kicker">EVIDENCE</span><h3>Evidence register</h3></header>{data.evidence.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.id} · {titleCase(item.kind)} · {titleCase(item.classification)}</small></div><span className={`status-pill status-${item.status === "verified" ? "success" : "neutral"}`}>{titleCase(item.status)}</span></article>)}</section>
    <section className="panel"><header><span className="section-kicker">REVIEW</span><h3>Review queue</h3></header>{data.reviews.map((item) => <article key={item.id}><div><b>{item.object.type.replaceAll("_", " ")} · {item.object.id}</b><small>Version {item.objectVersion} · Reviewer {item.reviewer}</small></div><span className={`status-pill status-${item.status === "approved" ? "success" : "neutral"}`}>{titleCase(item.status)}</span></article>)}</section>
    <section className="panel"><header><span className="section-kicker">VERSIONS</span><h3>Object versions</h3></header>{data.objectVersions.slice(0, 8).map((item) => <article key={item.id}><div><b>{item.object.type.replaceAll("_", " ")} · {item.object.id}</b><small>Version {item.version} · {item.changeSummary}</small></div><time>{item.createdAt.slice(0, 10)}</time></article>)}</section>
    <section className="panel"><header><span className="section-kicker">AUDIT</span><h3>Audit events</h3></header>{data.audit.slice(0, 8).map((item) => <article key={item.id}><div><b>{item.message}</b><small>{item.actor} · {item.object.type.replaceAll("_", " ")} {item.object.id}</small></div><time>{item.timestamp.slice(0, 10)}</time></article>)}</section>
  </div>;
}
