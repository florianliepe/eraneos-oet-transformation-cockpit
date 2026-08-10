import type { GovernanceMetadata, PmoDocument } from "./pmo-schema";

const at = "2026-08-01T09:00:00.000Z";
const governance = (version = 1, evidenceIds: string[] = [], reviewIds: string[] = []): GovernanceMetadata => ({
  version,
  reviewStatus: reviewIds.length ? "approved" : "not_requested",
  evidenceIds,
  reviewIds,
  createdAt: at,
  createdBy: "PMO Lead",
  updatedAt: at,
  updatedBy: "PMO Lead",
});

// Product-neutral demonstration data. Canonical tenant data is loaded through
// the protected policy API and validated against schema version 2.0.
export const bootstrapPmoData: PmoDocument = {
  schemaVersion: "2.0",
  revision: 1,
  project: {
    id: "TRANSFORM-DEMO",
    name: "Transformation Workspace",
    subtitle: "Governed project and transformation cockpit",
    phase: "Mobilisation",
    startDate: "2026-07-01",
    endDate: "2027-03-31",
    overallRag: "amber",
    progress: 18,
    updatedAt: at,
    governance: governance(1, ["EVD-CHARTER"]),
  },
  workstreams: [
    { id: "WS-1", name: "Programme mobilisation", shortName: "Mobilisation", owner: "Programme Lead", progress: 28, rag: "amber", governance: governance() },
  ],
  milestones: [
    { id: "M-1", title: "Mobilisation gate", phase: "Mobilisation", date: "2026-09-15", status: "upcoming", owner: "Programme Lead", description: "Confirm mandate, governance and delivery baseline.", governance: governance() },
  ],
  deliverables: [
    { id: "DEL-1", title: "Governed delivery baseline", workstream: "WS-1", dueDate: "2026-08-31", status: "in_progress", owner: "PMO Lead", progress: 45, priority: "P1", governance: governance(1, ["EVD-CHARTER"]) },
  ],
  risks: [
    { id: "R-1", title: "Decision latency", description: "Critical mobilisation decisions may not close before the gate.", probability: 3, impact: 4, state: "mitigating", owner: "Programme Lead", mitigation: "Pre-wire decisions with accountable owners.", updatedAt: "2026-08-01", governance: governance() },
  ],
  issues: [
    { id: "ISS-1", title: "Baseline ownership unresolved", description: "Two workstreams currently claim ownership of the integrated baseline.", owner: "PMO Lead", status: "in_progress", priority: "P1", severity: 4, raisedAt: "2026-08-01", dueDate: "2026-08-12", resolution: "", workstreamId: "WS-1", relatedRiskIds: ["R-1"], governance: governance(1, ["EVD-MTG-1"]) },
  ],
  actions: [
    { id: "ACTN-1", title: "Confirm baseline owner", description: "Nominate one accountable owner and communicate the decision.", owner: "Programme Lead", status: "open", priority: "P1", dueDate: "2026-08-12", relatedObjects: [{ type: "issue", id: "ISS-1" }, { type: "meeting", id: "MTG-1" }], governance: governance(1, ["EVD-MTG-1"]) },
  ],
  decisions: [
    { id: "DEC-1", title: "Use one integrated delivery baseline", context: "Parallel workstream plans create conflicting status signals.", decision: "The PMO will maintain one governed integrated baseline.", owner: "Programme Sponsor", status: "approved", decisionDate: "2026-08-01", approver: "Programme Sponsor", effectiveDate: "2026-08-01", impact: "All workstream reporting aligns to a single baseline.", relatedObjects: [{ type: "deliverable", id: "DEL-1" }, { type: "meeting", id: "MTG-1" }], governance: governance(1, ["EVD-MTG-1"], ["REV-DEC-1"]) },
  ],
  dependencies: [
    { id: "DEP-1", title: "Finance baseline input", description: "Validated cost assumptions are required before the mobilisation gate.", owner: "Finance Lead", provider: "Finance workstream", type: "internal", direction: "inbound", status: "active", criticality: "high", neededBy: "2026-08-28", relatedObjects: [{ type: "milestone", id: "M-1" }], governance: governance() },
  ],
  assumptions: [
    { id: "ASM-1", title: "Sponsor availability", statement: "The sponsor can attend fortnightly decision sessions through mobilisation.", owner: "Programme Lead", status: "active", criticality: "high", validationDueDate: "2026-08-15", validationMethod: "Confirm calendar commitments with the sponsor office.", impactIfFalse: "Decision turnaround will exceed the agreed governance cadence.", governance: governance() },
  ],
  changeRequests: [
    { id: "CR-1", title: "Extend mobilisation by two weeks", description: "Add time for cross-workstream baseline validation.", requester: "PMO Lead", owner: "Programme Sponsor", status: "under_review", priority: "P2", submittedAt: "2026-08-01", decisionDueDate: "2026-08-15", scopeImpact: "No scope change.", scheduleImpact: "Mobilisation gate moves by two weeks if approved.", costImpact: "Two additional weeks of mobilisation effort.", benefitImpact: "Higher confidence in the integrated baseline.", riskImpact: "Reduces rework risk.", governance: { ...governance(1, ["EVD-CHARTER"]), reviewStatus: "pending", reviewIds: ["REV-CR-1"] } },
  ],
  meetings: [
    { id: "MTG-1", title: "Weekly programme review", date: "2026-08-01", type: "working_session", participants: ["Programme Lead", "PMO Lead"], summary: "Reviewed mobilisation evidence, ownership and pending decisions.", decisionIds: ["DEC-1"], actionIds: ["ACTN-1"], governance: governance(1, ["EVD-MTG-1"]) },
  ],
  evidence: [
    { id: "EVD-CHARTER", title: "Programme charter", kind: "document", source: "Governed document repository", classification: "internal", status: "verified", capturedAt: at, capturedBy: "PMO Lead", relatedObjects: [{ type: "project", id: "TRANSFORM-DEMO" }, { type: "deliverable", id: "DEL-1" }, { type: "change_request", id: "CR-1" }] },
    { id: "EVD-MTG-1", title: "Weekly programme review notes", kind: "meeting_note", source: "Meeting hub", classification: "internal", status: "verified", capturedAt: at, capturedBy: "PMO Lead", relatedObjects: [{ type: "meeting", id: "MTG-1" }, { type: "decision", id: "DEC-1" }, { type: "action", id: "ACTN-1" }, { type: "issue", id: "ISS-1" }] },
  ],
  reviews: [
    { id: "REV-DEC-1", object: { type: "decision", id: "DEC-1" }, objectVersion: 1, status: "approved", requestedAt: at, requestedBy: "PMO Lead", reviewer: "Programme Sponsor", reviewedAt: at, rationale: "Decision is supported by the meeting record.", evidenceIds: ["EVD-MTG-1"] },
    { id: "REV-CR-1", object: { type: "change_request", id: "CR-1" }, objectVersion: 1, status: "pending", requestedAt: at, requestedBy: "PMO Lead", reviewer: "Programme Sponsor", rationale: "", evidenceIds: ["EVD-CHARTER"] },
  ],
  audit: [
    { id: "AUD-1", timestamp: at, actor: "PMO Lead", action: "create", object: { type: "project", id: "TRANSFORM-DEMO" }, message: "Created governed transformation workspace.", changes: [], evidenceIds: ["EVD-CHARTER"] },
    { id: "AUD-2", timestamp: at, actor: "Programme Sponsor", action: "approve", object: { type: "decision", id: "DEC-1" }, message: "Approved the integrated baseline decision.", changes: [{ field: "status", from: "proposed", to: "approved" }], evidenceIds: ["EVD-MTG-1"] },
  ],
  objectVersions: [
    { id: "VER-project-TRANSFORM-DEMO-1", object: { type: "project", id: "TRANSFORM-DEMO" }, version: 1, createdAt: at, createdBy: "PMO Lead", changeSummary: "Created transformation workspace.", evidenceIds: ["EVD-CHARTER"], snapshot: { name: "Transformation Workspace", phase: "Mobilisation", overallRag: "amber", progress: 18 } },
    { id: "VER-decision-DEC-1-1", object: { type: "decision", id: "DEC-1" }, version: 1, createdAt: at, createdBy: "PMO Lead", changeSummary: "Recorded approved baseline decision.", reviewId: "REV-DEC-1", evidenceIds: ["EVD-MTG-1"], snapshot: { title: "Use one integrated delivery baseline", status: "approved" } },
  ],
};
