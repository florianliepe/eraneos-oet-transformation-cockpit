import {
  PmoDocumentSchema,
  createAuditEvent,
  createGovernance,
  createObjectVersion,
  type GovernanceMetadata,
  type ObjectRef,
  type ObjectType,
  type PmoDocument,
} from "./pmo-schema";

export const governedCollections = {
  workstream: "workstreams",
  milestone: "milestones",
  deliverable: "deliverables",
  risk: "risks",
  issue: "issues",
  action: "actions",
  decision: "decisions",
  dependency: "dependencies",
  assumption: "assumptions",
  change_request: "changeRequests",
  meeting: "meetings",
} as const;

export type GovernedEntityType = keyof typeof governedCollections;
type RecordLike = { id: string; governance?: GovernanceMetadata; [key: string]: unknown };

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function changesBetween(current: RecordLike | undefined, next: RecordLike) {
  if (!current) return [];
  return Object.keys(next)
    .filter((field) => field !== "governance" && !valuesEqual(current[field], next[field]))
    .map((field) => ({ field, from: current[field], to: next[field] }));
}

export function upsertPmoRecord(
  document: PmoDocument,
  type: GovernedEntityType,
  input: RecordLike,
  actor = "PMO user",
  at = new Date().toISOString(),
  evidenceIds?: string[],
): PmoDocument {
  const key = governedCollections[type];
  const collection = document[key] as RecordLike[];
  const current = collection.find((item) => item.id === input.id);
  const governance = {
    ...createGovernance(actor, at, current?.governance),
    evidenceIds: evidenceIds ?? current?.governance?.evidenceIds ?? [],
  };
  const record = { ...input, governance };
  const object: ObjectRef = { type, id: input.id };
  const action = current ? "update" : "create";
  const label = String(input.title || input.name || input.id);
  const changeSummary = `${current ? "Updated" : "Created"} ${label}.`;
  const audit = createAuditEvent(object, action, changeSummary, actor, at, changesBetween(current, record));
  const version = createObjectVersion(object, record, governance, changeSummary);
  const nextCollection = current
    ? collection.map((item) => item.id === input.id ? record : item)
    : [record, ...collection];

  return PmoDocumentSchema.parse({
    ...document,
    [key]: nextCollection,
    audit: [audit, ...document.audit],
    objectVersions: [version, ...document.objectVersions],
  });
}

export function updateProject(
  document: PmoDocument,
  input: Omit<PmoDocument["project"], "governance">,
  actor = "PMO user",
  at = new Date().toISOString(),
  evidenceIds?: string[],
): PmoDocument {
  const governance = {
    ...createGovernance(actor, at, document.project.governance),
    evidenceIds: evidenceIds ?? document.project.governance.evidenceIds,
  };
  const record = { ...input, governance, updatedAt: at };
  const object: ObjectRef = { type: "project", id: input.id };
  const message = `Updated ${input.name}.`;
  return PmoDocumentSchema.parse({
    ...document,
    project: record,
    audit: [createAuditEvent(object, "update", message, actor, at, changesBetween(document.project, record)), ...document.audit],
    objectVersions: [createObjectVersion(object, record, governance, message), ...document.objectVersions],
  });
}

export function deletePmoRecord(document: PmoDocument, type: GovernedEntityType, id: string, label: string, actor = "PMO user", at = new Date().toISOString()): PmoDocument {
  const key = governedCollections[type];
  const collection = document[key] as RecordLike[];
  const object: ObjectRef = { type, id };
  return PmoDocumentSchema.parse({
    ...document,
    [key]: collection.filter((item) => item.id !== id),
    audit: [createAuditEvent(object, "delete", `Deleted ${label}.`, actor, at), ...document.audit],
  });
}

export function linkedRecordCount(document: PmoDocument, object: ObjectRef): number {
  const directRefs = [
    ...document.actions.flatMap((item) => item.relatedObjects),
    ...document.decisions.flatMap((item) => item.relatedObjects),
    ...document.dependencies.flatMap((item) => item.relatedObjects),
    ...document.evidence.flatMap((item) => item.relatedObjects),
  ].filter((item) => item.type === object.type && item.id === object.id).length;

  if (object.type === "workstream") {
    return directRefs
      + document.deliverables.filter((item) => item.workstream === object.id).length
      + document.issues.filter((item) => item.workstreamId === object.id).length;
  }
  if (object.type === "risk") return directRefs + document.issues.filter((item) => item.relatedRiskIds.includes(object.id)).length;
  if (object.type === "decision") return directRefs + document.changeRequests.filter((item) => item.decisionId === object.id).length + document.meetings.filter((item) => item.decisionIds.includes(object.id)).length;
  if (object.type === "action") return directRefs + document.meetings.filter((item) => item.actionIds.includes(object.id)).length;
  return directRefs;
}

export function validatePmoReferences(document: PmoDocument): string[] {
  const ids = new Map<ObjectType, Set<string>>();
  const add = (type: ObjectType, values: Array<{ id: string }>) => ids.set(type, new Set(values.map((item) => item.id)));
  add("project", [document.project]); add("workstream", document.workstreams); add("milestone", document.milestones);
  add("deliverable", document.deliverables); add("risk", document.risks); add("issue", document.issues);
  add("action", document.actions); add("decision", document.decisions); add("dependency", document.dependencies);
  add("assumption", document.assumptions); add("change_request", document.changeRequests); add("meeting", document.meetings);
  add("evidence", document.evidence);

  const errors: string[] = [];
  const check = (owner: string, ref: ObjectRef) => {
    if (!ids.get(ref.type)?.has(ref.id)) errors.push(`${owner} references missing ${ref.type} ${ref.id}.`);
  };
  document.actions.forEach((item) => item.relatedObjects.forEach((ref) => check(item.id, ref)));
  document.decisions.forEach((item) => item.relatedObjects.forEach((ref) => check(item.id, ref)));
  document.dependencies.forEach((item) => item.relatedObjects.forEach((ref) => check(item.id, ref)));
  document.evidence.forEach((item) => item.relatedObjects.forEach((ref) => check(item.id, ref)));
  document.meetings.forEach((item) => {
    item.actionIds.forEach((id) => check(item.id, { type: "action", id }));
    item.decisionIds.forEach((id) => check(item.id, { type: "decision", id }));
  });
  document.changeRequests.forEach((item) => { if (item.decisionId) check(item.id, { type: "decision", id: item.decisionId }); });
  document.issues.forEach((item) => {
    if (item.workstreamId) check(item.id, { type: "workstream", id: item.workstreamId });
    item.relatedRiskIds.forEach((id) => check(item.id, { type: "risk", id }));
  });
  document.reviews.forEach((item) => {
    check(item.id, item.object);
    item.evidenceIds.forEach((id) => check(item.id, { type: "evidence", id }));
  });
  document.objectVersions.forEach((item) => check(item.id, item.object));
  return errors;
}
