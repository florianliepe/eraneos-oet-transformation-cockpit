import { calculateCriticalPath } from "./programme-decision-support";
import { upsertPmoRecord, type GovernedEntityType } from "./pmo-domain";
import type { GovernanceMetadata, ObjectRef, PmoDocument } from "./pmo-schema";

export const PROJECT_DELIVERY_WORKBENCH_VERSION = "project-delivery-workbench-1.0" as const;
export const PROJECT_TEMPLATES = [{ id: "governed-transformation", version: "1.0", name: "Governed transformation project", description: "Charter evidence, accountable workstreams, milestone baseline, RAID control and review gate." }] as const;
export type DeliveryRegisterType = "issue" | "action" | "decision" | "dependency" | "assumption" | "change_request";
export type DeliverySort = "control_date" | "title" | "owner" | "status" | "version";
export type DeliverySavedView = { contractVersion: typeof PROJECT_DELIVERY_WORKBENCH_VERSION; id: string; name: string; register: DeliveryRegisterType; query: string; owner: string; status: string; sort: DeliverySort; direction: "asc" | "desc" };
export type BulkUpdatePreview = { type: DeliveryRegisterType; ids: string[]; expectedVersions: Record<string, number>; patch: { owner?: string; status?: string }; changes: Array<{ id: string; title: string; from: Record<string, unknown>; to: Record<string, unknown> }> };
export type ImportPreview = { type: DeliveryRegisterType; rows: Array<Record<string, string>>; errors: string[] };

const collectionKey: Record<DeliveryRegisterType, keyof Pick<PmoDocument, "issues" | "actions" | "decisions" | "dependencies" | "assumptions" | "changeRequests">> = { issue: "issues", action: "actions", decision: "decisions", dependency: "dependencies", assumption: "assumptions", change_request: "changeRequests" };
const controlDateField: Record<DeliveryRegisterType, string> = { issue: "dueDate", action: "dueDate", decision: "decisionDate", dependency: "neededBy", assumption: "validationDueDate", change_request: "decisionDueDate" };

function records(document: PmoDocument, type: DeliveryRegisterType) { return document[collectionKey[type]] as Array<Record<string, unknown> & { id: string; title: string; governance: GovernanceMetadata }>; }
export function deliveryRecordStatus(record: Record<string, unknown>) { return String(record.status || "recorded"); }
export function deliveryRecordOwner(record: Record<string, unknown>) { return String(record.owner || record.requester || "Unassigned"); }
export function deliveryControlDate(type: DeliveryRegisterType, record: Record<string, unknown>) { return String(record[controlDateField[type]] || ""); }

export function filterAndSortDeliveryRecords(document: PmoDocument, view: Omit<DeliverySavedView, "contractVersion" | "id" | "name">) {
  const query = view.query.trim().toLowerCase();
  const result = records(document, view.register).filter((record) => (!query || JSON.stringify(record).toLowerCase().includes(query)) && (view.owner === "all" || deliveryRecordOwner(record) === view.owner) && (view.status === "all" || deliveryRecordStatus(record) === view.status));
  const value = (record: typeof result[number]) => view.sort === "control_date" ? deliveryControlDate(view.register, record) : view.sort === "owner" ? deliveryRecordOwner(record) : view.sort === "status" ? deliveryRecordStatus(record) : view.sort === "version" ? record.governance.version : record.title;
  return [...result].sort((left, right) => { const a = value(left); const b = value(right); const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)); return view.direction === "asc" ? order : -order; });
}

export function previewBulkUpdate(document: PmoDocument, type: DeliveryRegisterType, ids: string[], patch: BulkUpdatePreview["patch"]): BulkUpdatePreview {
  const selected = records(document, type).filter((record) => ids.includes(record.id));
  if (!selected.length) throw new Error("Select at least one governed record.");
  if (!patch.owner?.trim() && !patch.status?.trim()) throw new Error("Choose an owner or status change to preview.");
  return { type, ids: selected.map((record) => record.id), expectedVersions: Object.fromEntries(selected.map((record) => [record.id, record.governance.version])), patch, changes: selected.map((record) => ({ id: record.id, title: record.title, from: { owner: deliveryRecordOwner(record), status: deliveryRecordStatus(record), version: record.governance.version }, to: { owner: patch.owner?.trim() || deliveryRecordOwner(record), status: patch.status || deliveryRecordStatus(record), version: record.governance.version + 1 } })) };
}

export function applyBulkUpdate(document: PmoDocument, preview: BulkUpdatePreview, actor: string, at = new Date().toISOString()) {
  let next = document;
  for (const id of preview.ids) {
    const record = records(next, preview.type).find((item) => item.id === id); if (!record) throw new Error(`Bulk update record ${id} is no longer available.`);
    if (record.governance.version !== preview.expectedVersions[id]) throw new Error(`Bulk update rejected stale version for ${id}. Refresh and preview again.`);
    next = upsertPmoRecord(next, preview.type as GovernedEntityType, { ...record, ...(preview.patch.owner?.trim() ? { owner: preview.patch.owner.trim() } : {}), ...(preview.patch.status ? { status: preview.patch.status } : {}) }, actor, at);
  }
  return next;
}

function csvCells(line: string) { const cells: string[] = []; let value = ""; let quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"' && line[index + 1] === '"') { value += '"'; index++; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { cells.push(value); value = ""; } else value += char; } cells.push(value); return cells.map((cell) => cell.trim()); }
export function previewCsvImport(type: DeliveryRegisterType, text: string): ImportPreview {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()); if (lines.length < 2) return { type, rows: [], errors: ["The import must contain a header and at least one data row."] };
  const headers = csvCells(lines[0]).map((header) => header.toLowerCase().replaceAll(" ", "_")); const required = ["id", "title", "owner", "status", "object_version"]; const errors = required.filter((field) => !headers.includes(field)).map((field) => `Missing required column: ${field}.`);
  const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, csvCells(line)[index] || ""]))).filter((row) => Object.values(row).some(Boolean));
  rows.forEach((row, index) => { if (!row.id || !row.title) errors.push(`Row ${index + 2} requires id and title.`); });
  return { type, rows, errors };
}

export function applyImportPreview(document: PmoDocument, preview: ImportPreview, actor: string, at = new Date().toISOString()) {
  if (preview.errors.length) throw new Error("Resolve every import preview error before applying changes.");
  let next = document;
  for (const row of preview.rows) {
    const record = records(next, preview.type).find((item) => item.id === row.id); if (!record) throw new Error(`Import cannot create unknown record ${row.id}; create it through the guided editor first.`);
    if (record.governance.version !== Number(row.object_version)) throw new Error(`Import rejected stale object version for ${row.id}.`);
    const updated = upsertPmoRecord(next, preview.type as GovernedEntityType, { ...record, title: row.title, owner: row.owner, status: row.status }, actor, at);
    updated.audit[0] = { ...updated.audit[0], action: "import", message: `Imported governed update for ${row.id}.` };
    next = updated;
  }
  return next;
}

export function exportRegisterCsv(document: PmoDocument, type: DeliveryRegisterType) {
  const headers = ["id", "title", "owner", "status", "control_date", "object_version", "review_status", "evidence_ids"];
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...records(document, type).map((record) => [record.id, record.title, deliveryRecordOwner(record), deliveryRecordStatus(record), deliveryControlDate(type, record), record.governance.version, (record.governance as { reviewStatus?: string }).reviewStatus || "", ((record.governance as { evidenceIds?: string[] }).evidenceIds || []).join("|")].map(quote).join(","))].join("\n");
}

export type DeliveryRelationship = { source: ObjectRef; target: ObjectRef; relation: string };
export function deliveryRelationships(document: PmoDocument): DeliveryRelationship[] {
  return [
    ...document.actions.flatMap((item) => item.relatedObjects.map((target) => ({ source: { type: "action" as const, id: item.id }, target, relation: "acts on" }))),
    ...document.decisions.flatMap((item) => item.relatedObjects.map((target) => ({ source: { type: "decision" as const, id: item.id }, target, relation: "governs" }))),
    ...document.dependencies.flatMap((item) => item.relatedObjects.map((target) => ({ source: { type: "dependency" as const, id: item.id }, target, relation: "depends on" }))),
    ...document.issues.flatMap((item) => item.relatedRiskIds.map((id) => ({ source: { type: "issue" as const, id: item.id }, target: { type: "risk" as const, id }, relation: "realises" }))),
    ...document.changeRequests.flatMap((item) => item.decisionId ? [{ source: { type: "change_request" as const, id: item.id }, target: { type: "decision" as const, id: item.decisionId }, relation: "resolved by" }] : []),
  ];
}

export function deliveryTimeline(document: PmoDocument) {
  let criticalIds = new Set<string>(); let explanation = "No defensible dependency critical path is available.";
  try { const path = calculateCriticalPath(document); criticalIds = new Set(path.nodes); explanation = path.nodes.length ? `${path.nodes.join(" → ")} · ${path.totalLagDays} dependency lag day(s).` : explanation; } catch (reason) { explanation = reason instanceof Error ? reason.message : explanation; }
  return { milestones: [...document.milestones].sort((left, right) => left.date.localeCompare(right.date)).map((item) => ({ ...item, critical: criticalIds.has(`milestone:${item.id}`) })), explanation };
}

export function onboardingChecklist(document: PmoDocument) {
  return [
    { id: "charter", label: "Project charter evidence linked", complete: document.project.governance.evidenceIds.length > 0 },
    { id: "ownership", label: "Delivery ownership assigned", complete: document.workstreams.length > 0 && document.workstreams.every((item) => Boolean(item.owner)) },
    { id: "milestones", label: "Milestone baseline recorded", complete: document.milestones.length > 0 },
    { id: "raid", label: "RAID baseline reviewed", complete: document.risks.length + document.issues.length + document.assumptions.length > 0 },
    { id: "governance", label: "Accountable review requested", complete: document.reviews.length > 0 },
  ];
}
