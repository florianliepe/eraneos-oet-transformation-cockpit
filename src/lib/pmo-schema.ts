import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DateTimeSchema = z.string().datetime();

export const RagSchema = z.enum(["green", "amber", "red", "grey"]);
export const PrioritySchema = z.enum(["P1", "P2", "P3"]);
export const DeliveryStatusSchema = z.enum(["not_started", "in_progress", "at_risk", "blocked", "done"]);
export const ObjectTypeSchema = z.enum([
  "project", "workstream", "milestone", "deliverable", "risk", "issue", "action",
  "decision", "dependency", "assumption", "change_request", "meeting", "evidence",
]);
export const ObjectRefSchema = z.object({ type: ObjectTypeSchema, id: z.string().min(1) });

export const GovernanceMetadataSchema = z.object({
  version: z.number().int().min(1),
  reviewStatus: z.enum(["not_requested", "pending", "approved", "changes_requested", "rejected"]),
  evidenceIds: z.array(z.string()).default([]),
  reviewIds: z.array(z.string()).default([]),
  createdAt: DateTimeSchema,
  createdBy: z.string().min(1),
  updatedAt: DateTimeSchema,
  updatedBy: z.string().min(1),
});

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["document", "meeting_note", "data_extract", "image", "correspondence", "system_record", "other"]),
  source: z.string().min(1),
  uri: z.string().optional(),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  status: z.enum(["proposed", "verified", "rejected"]),
  capturedAt: DateTimeSchema,
  capturedBy: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  relatedObjects: z.array(ObjectRefSchema).default([]),
});

export const ReviewRecordSchema = z.object({
  id: z.string().min(1),
  object: ObjectRefSchema,
  objectVersion: z.number().int().min(1),
  status: z.enum(["pending", "approved", "changes_requested", "rejected"]),
  requestedAt: DateTimeSchema,
  requestedBy: z.string().min(1),
  reviewer: z.string().min(1),
  reviewedAt: DateTimeSchema.optional(),
  rationale: z.string().default(""),
  evidenceIds: z.array(z.string()).default([]),
});

export const AuditChangeSchema = z.object({
  field: z.string().min(1),
  from: z.unknown().optional(),
  to: z.unknown().optional(),
});

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  timestamp: DateTimeSchema,
  actor: z.string().min(1),
  action: z.enum(["create", "update", "delete", "submit_review", "approve", "reject", "link", "unlink", "import", "publish", "migrate"]),
  object: ObjectRefSchema,
  message: z.string().min(1),
  correlationId: z.string().optional(),
  changes: z.array(AuditChangeSchema).default([]),
  evidenceIds: z.array(z.string()).default([]),
});

export const ObjectVersionSchema = z.object({
  id: z.string().min(1),
  object: ObjectRefSchema,
  version: z.number().int().min(1),
  createdAt: DateTimeSchema,
  createdBy: z.string().min(1),
  changeSummary: z.string().min(1),
  reviewId: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  snapshot: z.record(z.string(), z.unknown()),
});

const governed = { governance: GovernanceMetadataSchema };

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  phase: z.string().min(1),
  startDate: DateSchema,
  endDate: DateSchema,
  overallRag: RagSchema,
  progress: z.number().min(0).max(100),
  updatedAt: DateTimeSchema,
  ...governed,
});

export const WorkstreamSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), shortName: z.string().min(1),
  owner: z.string().min(1), progress: z.number().min(0).max(100), rag: RagSchema, ...governed,
});

export const MilestoneSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), phase: z.string().min(1), date: DateSchema,
  status: z.enum(["upcoming", "at_risk", "complete"]), owner: z.string().min(1),
  description: z.string().default(""), ...governed,
});

export const DeliverableSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), workstream: z.string().min(1), dueDate: DateSchema,
  status: DeliveryStatusSchema, owner: z.string().min(1), progress: z.number().min(0).max(100),
  priority: PrioritySchema, ...governed,
});

export const RiskSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().default(""),
  probability: z.number().int().min(1).max(5), impact: z.number().int().min(1).max(5),
  state: z.enum(["open", "mitigating", "monitoring", "closed"]), owner: z.string().min(1),
  mitigation: z.string().default(""), updatedAt: DateSchema, ...governed,
});

export const IssueSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().min(1),
  owner: z.string().min(1), status: z.enum(["open", "in_progress", "resolved", "closed"]),
  priority: PrioritySchema, severity: z.number().int().min(1).max(5), raisedAt: DateSchema,
  dueDate: DateSchema.optional(), resolution: z.string().default(""), workstreamId: z.string().optional(),
  relatedRiskIds: z.array(z.string()).default([]), ...governed,
});

export const ActionSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().default(""),
  owner: z.string().min(1), status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]),
  priority: PrioritySchema, dueDate: DateSchema, completedAt: DateTimeSchema.optional(),
  relatedObjects: z.array(ObjectRefSchema).default([]), ...governed,
});

export const DecisionSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), context: z.string().min(1),
  decision: z.string().min(1), owner: z.string().min(1), status: z.enum(["proposed", "approved", "rejected", "superseded"]),
  decisionDate: DateSchema, approver: z.string().optional(), effectiveDate: DateSchema.optional(),
  impact: z.string().default(""), relatedObjects: z.array(ObjectRefSchema).default([]), ...governed,
});

export const DependencySchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().min(1),
  owner: z.string().min(1), provider: z.string().min(1), type: z.enum(["internal", "external"]),
  direction: z.enum(["inbound", "outbound", "mutual"]), status: z.enum(["identified", "active", "at_risk", "resolved"]),
  criticality: z.enum(["low", "medium", "high", "critical"]), neededBy: DateSchema,
  relatedObjects: z.array(ObjectRefSchema).default([]), ...governed,
});

export const AssumptionSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), statement: z.string().min(1),
  owner: z.string().min(1), status: z.enum(["active", "validated", "invalidated", "retired"]),
  criticality: z.enum(["low", "medium", "high", "critical"]), validationDueDate: DateSchema,
  validationMethod: z.string().min(1), impactIfFalse: z.string().min(1), ...governed,
});

export const ChangeRequestSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), description: z.string().min(1),
  requester: z.string().min(1), owner: z.string().min(1),
  status: z.enum(["draft", "submitted", "under_review", "approved", "rejected", "implemented", "withdrawn"]),
  priority: PrioritySchema, submittedAt: DateSchema, decisionDueDate: DateSchema.optional(),
  scopeImpact: z.string().default(""), scheduleImpact: z.string().default(""),
  costImpact: z.string().default(""), benefitImpact: z.string().default(""), riskImpact: z.string().default(""),
  decisionId: z.string().optional(), ...governed,
});

export const MeetingSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), date: DateSchema,
  type: z.enum(["steering", "working_session", "workstream", "decision"]),
  participants: z.array(z.string()).default([]), summary: z.string().min(1),
  decisionIds: z.array(z.string()).default([]), actionIds: z.array(z.string()).default([]), ...governed,
});

export const PmoDocumentSchema = z.object({
  schemaVersion: z.literal("2.0"),
  revision: z.number().int().min(1),
  project: ProjectSchema,
  workstreams: z.array(WorkstreamSchema),
  milestones: z.array(MilestoneSchema),
  deliverables: z.array(DeliverableSchema),
  risks: z.array(RiskSchema),
  issues: z.array(IssueSchema),
  actions: z.array(ActionSchema),
  decisions: z.array(DecisionSchema),
  dependencies: z.array(DependencySchema),
  assumptions: z.array(AssumptionSchema),
  changeRequests: z.array(ChangeRequestSchema),
  meetings: z.array(MeetingSchema),
  evidence: z.array(EvidenceRecordSchema),
  reviews: z.array(ReviewRecordSchema),
  audit: z.array(AuditEventSchema),
  objectVersions: z.array(ObjectVersionSchema),
});

const LegacyGovernanceFreeRecord = z.object({ id: z.string().min(1) }).passthrough();
const LegacyMeetingSchema = z.object({
  id: z.string(), title: z.string(), date: DateSchema,
  type: z.enum(["steering", "working_session", "workstream", "decision"]),
  participants: z.array(z.string()).default([]), summary: z.string(),
  decisions: z.array(z.string()).default([]),
  actions: z.array(z.object({ text: z.string(), owner: z.string(), dueDate: DateSchema })).default([]),
});
const LegacyPmoDocumentSchema = z.object({
  schemaVersion: z.literal("1.0"), revision: z.number().int().min(1),
  project: z.object({ id: z.string(), name: z.string(), subtitle: z.string(), phase: z.string(), startDate: DateSchema, endDate: DateSchema, overallRag: RagSchema, progress: z.number(), updatedAt: DateTimeSchema }),
  workstreams: z.array(LegacyGovernanceFreeRecord), milestones: z.array(LegacyGovernanceFreeRecord),
  deliverables: z.array(LegacyGovernanceFreeRecord), risks: z.array(LegacyGovernanceFreeRecord),
  meetings: z.array(LegacyMeetingSchema),
  activity: z.array(z.object({ id: z.string(), timestamp: DateTimeSchema, actor: z.string(), message: z.string(), entityId: z.string().optional() })).default([]),
});

export type PmoDocument = z.infer<typeof PmoDocumentSchema>;
export type Rag = z.infer<typeof RagSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
export type ObjectRef = z.infer<typeof ObjectRefSchema>;
export type GovernanceMetadata = z.infer<typeof GovernanceMetadataSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type ObjectVersion = z.infer<typeof ObjectVersionSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Deliverable = z.infer<typeof DeliverableSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Dependency = z.infer<typeof DependencySchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;

export function createGovernance(actor: string, at = new Date().toISOString(), current?: GovernanceMetadata): GovernanceMetadata {
  return {
    version: (current?.version ?? 0) + 1,
    reviewStatus: current ? "not_requested" : "not_requested",
    evidenceIds: current?.evidenceIds ?? [],
    reviewIds: current?.reviewIds ?? [],
    createdAt: current?.createdAt ?? at,
    createdBy: current?.createdBy ?? actor,
    updatedAt: at,
    updatedBy: actor,
  };
}
export function createAuditEvent(object: ObjectRef, action: AuditEvent["action"], message: string, actor: string, at = new Date().toISOString(), changes: AuditEvent["changes"] = []): AuditEvent {
  return { id: `AUD-${Date.now()}-${object.id}`, timestamp: at, actor, action, object, message, changes, evidenceIds: [] };
}

export function createObjectVersion(object: ObjectRef, record: Record<string, unknown>, governance: GovernanceMetadata, changeSummary: string): ObjectVersion {
  return {
    id: `VER-${object.type}-${object.id}-${governance.version}`,
    object,
    version: governance.version,
    createdAt: governance.updatedAt,
    createdBy: governance.updatedBy,
    changeSummary,
    evidenceIds: governance.evidenceIds,
    snapshot: record,
  };
}

function migratedGovernance(at: string): GovernanceMetadata {
  return { version: 1, reviewStatus: "not_requested", evidenceIds: [], reviewIds: [], createdAt: at, createdBy: "Schema migration", updatedAt: at, updatedBy: "Schema migration" };
}

export function migratePmoDocument(input: unknown): PmoDocument {
  const current = PmoDocumentSchema.safeParse(input);
  if (current.success) return current.data;

  const legacy = LegacyPmoDocumentSchema.parse(input);
  const at = legacy.project.updatedAt;
  const governance = () => migratedGovernance(at);
  const decisions: Decision[] = [];
  const actions: Action[] = [];
  const meetings: Meeting[] = legacy.meetings.map((meeting) => {
    const decisionIds = meeting.decisions.map((text, index) => {
      const id = `DEC-${meeting.id}-${index + 1}`;
      decisions.push({ id, title: text, context: meeting.summary, decision: text, owner: meeting.participants[0] || "PMO Lead", status: "approved", decisionDate: meeting.date, impact: "", relatedObjects: [{ type: "meeting", id: meeting.id }], governance: governance() });
      return id;
    });
    const actionIds = meeting.actions.map((item, index) => {
      const id = `ACTN-${meeting.id}-${index + 1}`;
      actions.push({ id, title: item.text, description: "", owner: item.owner, status: "open", priority: "P2", dueDate: item.dueDate, relatedObjects: [{ type: "meeting", id: meeting.id }], governance: governance() });
      return id;
    });
    return { id: meeting.id, title: meeting.title, date: meeting.date, type: meeting.type, participants: meeting.participants, summary: meeting.summary, decisionIds, actionIds, governance: governance() };
  });

  const migrated = {
    schemaVersion: "2.0" as const,
    revision: legacy.revision,
    project: { ...legacy.project, governance: governance() },
    workstreams: legacy.workstreams.map((item) => ({ ...item, governance: governance() })),
    milestones: legacy.milestones.map((item) => ({ ...item, governance: governance() })),
    deliverables: legacy.deliverables.map((item) => ({ ...item, governance: governance() })),
    risks: legacy.risks.map((item) => ({ ...item, governance: governance() })),
    issues: [], actions, decisions, dependencies: [], assumptions: [], changeRequests: [], meetings,
    evidence: [], reviews: [],
    audit: legacy.activity.map((item) => ({ id: item.id, timestamp: item.timestamp, actor: item.actor, action: "migrate" as const, object: { type: "project" as const, id: legacy.project.id }, message: item.message, changes: [], evidenceIds: [] })),
    objectVersions: [],
  };
  return PmoDocumentSchema.parse(migrated);
}
