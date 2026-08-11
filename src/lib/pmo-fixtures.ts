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
    { id: "DEP-2", title: "Baseline before mobilisation gate", description: "The governed delivery baseline must complete before the mobilisation gate.", owner: "PMO Lead", provider: "Programme mobilisation", type: "internal", direction: "outbound", status: "active", criticality: "critical", neededBy: "2026-09-15", relatedObjects: [{ type: "deliverable", id: "DEL-1" }, { type: "milestone", id: "M-1" }], governance: governance(1, ["EVD-PORTFOLIO"]) },
  ],
  assumptions: [
    { id: "ASM-1", title: "Sponsor availability", statement: "The sponsor can attend fortnightly decision sessions through mobilisation.", owner: "Programme Lead", status: "active", criticality: "high", validationDueDate: "2026-08-15", validationMethod: "Confirm calendar commitments with the sponsor office.", impactIfFalse: "Decision turnaround will exceed the agreed governance cadence.", governance: governance() },
  ],
  changeRequests: [
    { id: "CR-1", title: "Extend mobilisation by two weeks", description: "Add time for cross-workstream baseline validation.", requester: "PMO Lead", owner: "Programme Sponsor", status: "under_review", priority: "P2", submittedAt: "2026-08-01", decisionDueDate: "2026-08-15", scopeImpact: "No scope change.", scheduleImpact: "Mobilisation gate moves by two weeks if approved.", costImpact: "Two additional weeks of mobilisation effort.", benefitImpact: "Higher confidence in the integrated baseline.", riskImpact: "Reduces rework risk.", governance: { ...governance(1, ["EVD-CHARTER"]), reviewStatus: "pending", reviewIds: ["REV-CR-1"] } },
  ],
  portfolios: [
    { id: "PORT-1", name: "OET transformation portfolio", owner: "Portfolio Sponsor", objective: "Coordinate governed transformation outcomes across programmes.", rag: "amber", programmeIds: ["PROG-1"], governance: governance(1, ["EVD-PORTFOLIO"], ["REV-PORT-1"]) },
  ],
  programmes: [
    { id: "PROG-1", name: "Operating model transformation", owner: "Programme Lead", portfolioId: "PORT-1", objective: "Establish the target operating model and measurable adoption outcomes.", startDate: "2026-07-01", endDate: "2027-03-31", projectIds: ["TRANSFORM-DEMO"], rag: "amber", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-PROG-1"]) },
  ],
  outcomes: [
    { id: "OUT-1", title: "Decision cycle time reduced", owner: "Programme Lead", programmeId: "PROG-1", measure: "Average decision cycle days", target: 5, forecast: 7, actual: 9, targetDate: "2027-03-31", status: "at_risk", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-OUT-1"]) },
  ],
  benefits: [
    { id: "BEN-1", title: "Avoided coordination effort", owner: "Value Lead", programmeId: "PROG-1", outcomeId: "OUT-1", unit: "EUR", baseline: 0, target: 500000, forecast: 420000, actual: 90000, targetDate: "2027-03-31", status: "tracking", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-BEN-1"]) },
  ],
  resourcePools: [
    { id: "RES-1", name: "Transformation delivery capability", programmeId: "PROG-1", capability: "Programme and change delivery", period: "2026-08", capacityFte: 8, demandFte: 10.5, status: "constrained", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-RES-1"]) },
  ],
  financials: [
    { id: "FIN-1", title: "Programme investment", programmeId: "PROG-1", period: "2026-08", category: "investment", currency: "EUR", baseline: 1200000, forecast: 1320000, actual: 340000, governance: governance(1, ["EVD-PORTFOLIO"], ["REV-FIN-1"]) },
  ],
  scenarios: [
    { id: "SCN-1", title: "Approved mobilisation baseline", programmeId: "PROG-1", owner: "Portfolio Sponsor", status: "approved", baselineRevision: 1, assumptions: ["Current mobilisation staffing remains available."], scheduleDeltaDays: 0, costDelta: 0, benefitDelta: 0, rationale: "Approved reference scenario; changes require governed review.", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-SCN-1"]) },
    { id: "SCN-2", title: "Accelerated decision cadence", programmeId: "PROG-1", owner: "Programme Lead", status: "pending_review", baselineRevision: 1, assumptions: ["Sponsor decision slots are reserved weekly."], scheduleDeltaDays: -14, costDelta: 80000, benefitDelta: 110000, rationale: "Compare time-to-value improvement without overwriting the approved baseline.", governance: governance(1, ["EVD-PORTFOLIO"], ["REV-SCN-2"]) },
  ],
  meetings: [
    { id: "MTG-1", title: "Weekly programme review", date: "2026-08-01", type: "working_session", participants: ["Programme Lead", "PMO Lead"], summary: "Reviewed mobilisation evidence, ownership and pending decisions.", decisionIds: ["DEC-1"], actionIds: ["ACTN-1"], governance: governance(1, ["EVD-MTG-1"]) },
  ],
  evidence: [
    { id: "EVD-CHARTER", title: "Programme charter", kind: "document", source: "Governed document repository", classification: "internal", status: "verified", capturedAt: at, capturedBy: "PMO Lead", relatedObjects: [{ type: "project", id: "TRANSFORM-DEMO" }, { type: "deliverable", id: "DEL-1" }, { type: "change_request", id: "CR-1" }] },
    { id: "EVD-MTG-1", title: "Weekly programme review notes", kind: "meeting_note", source: "Meeting hub", classification: "internal", status: "verified", capturedAt: at, capturedBy: "PMO Lead", relatedObjects: [{ type: "meeting", id: "MTG-1" }, { type: "decision", id: "DEC-1" }, { type: "action", id: "ACTN-1" }, { type: "issue", id: "ISS-1" }] },
    { id: "EVD-PORTFOLIO", title: "Portfolio baseline and value case", kind: "data_extract", source: "Governed portfolio baseline", classification: "internal", status: "verified", capturedAt: at, capturedBy: "Portfolio PMO", relatedObjects: [{ type: "portfolio", id: "PORT-1" }, { type: "programme", id: "PROG-1" }, { type: "outcome", id: "OUT-1" }, { type: "benefit", id: "BEN-1" }, { type: "resource", id: "RES-1" }, { type: "financial", id: "FIN-1" }, { type: "scenario", id: "SCN-1" }, { type: "scenario", id: "SCN-2" }] },
  ],
  reviews: [
    { id: "REV-DEC-1", object: { type: "decision", id: "DEC-1" }, objectVersion: 1, status: "approved", requestedAt: at, requestedBy: "PMO Lead", reviewer: "Programme Sponsor", reviewedAt: at, rationale: "Decision is supported by the meeting record.", evidenceIds: ["EVD-MTG-1"] },
    { id: "REV-CR-1", object: { type: "change_request", id: "CR-1" }, objectVersion: 1, status: "pending", requestedAt: at, requestedBy: "PMO Lead", reviewer: "Programme Sponsor", rationale: "", evidenceIds: ["EVD-CHARTER"] },
    ...(["PORT-1", "PROG-1", "OUT-1", "BEN-1", "RES-1", "FIN-1", "SCN-1", "SCN-2"] as const).map((id) => ({ id: `REV-${id}`, object: { type: ({ "PORT-1": "portfolio", "PROG-1": "programme", "OUT-1": "outcome", "BEN-1": "benefit", "RES-1": "resource", "FIN-1": "financial", "SCN-1": "scenario", "SCN-2": "scenario" } as const)[id], id }, objectVersion: 1, status: id === "SCN-2" ? "pending" as const : "approved" as const, requestedAt: at, requestedBy: "Portfolio PMO", reviewer: "Portfolio Sponsor", reviewedAt: id === "SCN-2" ? undefined : at, rationale: id === "SCN-2" ? "" : "Evidence supports the governed portfolio baseline.", evidenceIds: ["EVD-PORTFOLIO"] })),
  ],
  audit: [
    { id: "AUD-1", timestamp: at, actor: "PMO Lead", action: "create", object: { type: "project", id: "TRANSFORM-DEMO" }, message: "Created governed transformation workspace.", changes: [], evidenceIds: ["EVD-CHARTER"] },
    { id: "AUD-2", timestamp: at, actor: "Programme Sponsor", action: "approve", object: { type: "decision", id: "DEC-1" }, message: "Approved the integrated baseline decision.", changes: [{ field: "status", from: "proposed", to: "approved" }], evidenceIds: ["EVD-MTG-1"] },
    ...(["portfolio:PORT-1", "programme:PROG-1", "outcome:OUT-1", "benefit:BEN-1", "resource:RES-1", "financial:FIN-1", "scenario:SCN-1", "scenario:SCN-2"] as const).map((entry, index) => { const [type, id] = entry.split(":") as ["portfolio" | "programme" | "outcome" | "benefit" | "resource" | "financial" | "scenario", string]; return { id: `AUD-PORT-${index + 1}`, timestamp: at, actor: "Portfolio PMO", action: "create" as const, object: { type, id }, message: `Created governed ${type} ${id}.`, changes: [], evidenceIds: ["EVD-PORTFOLIO"] }; }),
  ],
  objectVersions: [
    { id: "VER-project-TRANSFORM-DEMO-1", object: { type: "project", id: "TRANSFORM-DEMO" }, version: 1, createdAt: at, createdBy: "PMO Lead", changeSummary: "Created transformation workspace.", evidenceIds: ["EVD-CHARTER"], snapshot: { name: "Transformation Workspace", phase: "Mobilisation", overallRag: "amber", progress: 18 } },
    { id: "VER-decision-DEC-1-1", object: { type: "decision", id: "DEC-1" }, version: 1, createdAt: at, createdBy: "PMO Lead", changeSummary: "Recorded approved baseline decision.", reviewId: "REV-DEC-1", evidenceIds: ["EVD-MTG-1"], snapshot: { title: "Use one integrated delivery baseline", status: "approved" } },
    ...(["portfolio:PORT-1", "programme:PROG-1", "outcome:OUT-1", "benefit:BEN-1", "resource:RES-1", "financial:FIN-1", "scenario:SCN-1", "scenario:SCN-2"] as const).map((entry) => { const [type, id] = entry.split(":") as ["portfolio" | "programme" | "outcome" | "benefit" | "resource" | "financial" | "scenario", string]; return { id: `VER-${type}-${id}-1`, object: { type, id }, version: 1, createdAt: at, createdBy: "Portfolio PMO", changeSummary: `Created governed ${type} baseline.`, reviewId: `REV-${id}`, evidenceIds: ["EVD-PORTFOLIO"], snapshot: { id } }; }),
  ],
};
