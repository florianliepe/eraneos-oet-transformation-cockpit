"use client";

import { useEffect, useState } from "react";
import { Icons } from "./icons";
import type { EditableEntity, EditorTarget } from "./entity-editor";
import type { PmoDocument } from "@/lib/pmo-schema";

type RegisterType = "issue" | "action" | "decision" | "dependency" | "assumption" | "change_request" | "governance";
type DeletableRegisterType = Exclude<RegisterType, "governance">;
type RegisterColumn = "owner" | "date" | "version" | "evidence";
const columnLabels: Record<RegisterColumn, string> = { owner: "Owner", date: "Control date", version: "Version", evidence: "Evidence" };
const COLUMN_STORAGE_KEY = "transformation-cockpit:register-columns";

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

export function DomainRegisters({ data, query, onEdit, onDelete }: {
  data: PmoDocument;
  query: string;
  onEdit: (target: EditorTarget) => void;
  onDelete: (entity: Exclude<EditableEntity, "project">, id: string, label: string) => void;
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
  const filtered = active === "governance" ? [] : records[active].filter((item) =>
    !query || JSON.stringify(item).toLowerCase().includes(query),
  );

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
      {(Object.keys(labels) as RegisterType[]).map((type) => <button role="tab" aria-selected={active === type} className={active === type ? "active" : ""} onClick={() => setActive(type)} key={type}>{labels[type]}</button>)}
    </div>

    {active !== "governance" && <section className="panel register-panel">
      <header className="panel-heading"><div><span className="section-kicker">{active.replaceAll("_", " ").toUpperCase()}</span><h3>{labels[active]}</h3></div><div className="register-toolbar"><details><summary>Columns ({columns.length})</summary><fieldset><legend>Visible record fields</legend>{(Object.keys(columnLabels) as RegisterColumn[]).map((column) => <label key={column}><input type="checkbox" checked={columns.includes(column)} onChange={() => toggleColumn(column)}/>{columnLabels[column]}</label>)}</fieldset></details><button className="button primary" onClick={() => onEdit({ entity: active })}><Icons.plus/>Add {labels[active].slice(0, -1).toLowerCase()}</button></div></header>
      <div className="register-grid">{filtered.map((item) => {
        const record = item as Record<string, unknown> & { id: string; title: string; governance: { version: number; reviewStatus: string; evidenceIds: string[] } };
        return <article className="register-card" key={record.id}>
          <header><span>{record.id}</span><span className={`status-pill status-${["approved", "resolved", "done", "implemented", "validated"].includes(statusOf(record)) ? "success" : "neutral"}`}>{titleCase(statusOf(record))}</span></header>
          <h4>{record.title}</h4>
          <p>{String(record.description ?? record.statement ?? record.context ?? record.decision ?? "")}</p>
          <div className="register-meta" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>{columns.includes("owner") && <span><b>Owner</b>{String(record.owner ?? record.requester ?? "Unassigned")}</span>}{columns.includes("date") && <span><b>Control date</b>{dueOf(active, record)}</span>}{columns.includes("version") && <span><b>Version</b>{record.governance.version}</span>}{columns.includes("evidence") && <span><b>Evidence</b>{record.governance.evidenceIds.length}</span>}</div>
          <footer><span>Review: {titleCase(record.governance.reviewStatus)}</span><div className="record-actions"><button onClick={() => onEdit({ entity: active, id: record.id })} aria-label={`Edit ${record.title}`}><Icons.edit/></button><button onClick={() => onDelete(active, record.id, record.title)} aria-label={`Delete ${record.title}`}><Icons.trash/></button></div></footer>
        </article>;
      })}{filtered.length === 0 && <div className="empty-state">No {labels[active].toLowerCase()} match the current filter.</div>}</div>
    </section>}

    {active === "governance" && <GovernanceRegister data={data}/>}
  </div>;
}

function GovernanceRegister({ data }: { data: PmoDocument }) {
  return <div className="governance-register">
    <section className="panel"><header><span className="section-kicker">EVIDENCE</span><h3>Evidence register</h3></header>{data.evidence.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.id} · {titleCase(item.kind)} · {titleCase(item.classification)}</small></div><span className={`status-pill status-${item.status === "verified" ? "success" : "neutral"}`}>{titleCase(item.status)}</span></article>)}</section>
    <section className="panel"><header><span className="section-kicker">REVIEW</span><h3>Review queue</h3></header>{data.reviews.map((item) => <article key={item.id}><div><b>{item.object.type.replaceAll("_", " ")} · {item.object.id}</b><small>Version {item.objectVersion} · Reviewer {item.reviewer}</small></div><span className={`status-pill status-${item.status === "approved" ? "success" : "neutral"}`}>{titleCase(item.status)}</span></article>)}</section>
    <section className="panel"><header><span className="section-kicker">VERSIONS</span><h3>Object versions</h3></header>{data.objectVersions.slice(0, 8).map((item) => <article key={item.id}><div><b>{item.object.type.replaceAll("_", " ")} · {item.object.id}</b><small>Version {item.version} · {item.changeSummary}</small></div><time>{item.createdAt.slice(0, 10)}</time></article>)}</section>
    <section className="panel"><header><span className="section-kicker">AUDIT</span><h3>Audit events</h3></header>{data.audit.slice(0, 8).map((item) => <article key={item.id}><div><b>{item.message}</b><small>{item.actor} · {item.object.type.replaceAll("_", " ")} {item.object.id}</small></div><time>{item.timestamp.slice(0, 10)}</time></article>)}</section>
  </div>;
}
