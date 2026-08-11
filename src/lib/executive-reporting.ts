import { z } from "zod";
import { SteercoSnapshotSchema, type SteercoSnapshot } from "@/lib/steerco-schema";

export const EXECUTIVE_REPORTING_CONTRACT_VERSION = "executive-reporting-1.0" as const;

export const REPORT_TEMPLATES = [
  { id: "project_steerco", title: "Project Steering Committee", purpose: "Evidence-linked project status, decisions and delivery tolerance." },
  { id: "portfolio_review", title: "Portfolio review", purpose: "Comparable approved project snapshots with explicit missing-data states." },
] as const;

export const ReportScopeSchema = z.object({
  organisationId: z.string().min(8),
  targetKind: z.enum(["project", "portfolio"]),
  targetIds: z.array(z.string().min(8)).min(1),
});

export const DecisionRequestSchema = z.object({
  id: z.string().min(1), title: z.string().min(3), owner: z.string().min(2), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["requested", "decided", "withdrawn"]).default("requested"), sourceIds: z.array(z.string()).default([]),
});

export const PublicationReceiptSchema = z.object({
  id: z.string().min(1), action: z.enum(["approved", "published", "revoked", "restored"]), actor: z.string().min(1), at: z.string().datetime(),
  snapshotId: z.string().min(1), snapshotRevision: z.number().int().positive(), sourceFingerprint: z.string().min(8), reason: z.string().optional(), previousReceiptId: z.string().optional(),
});

export const ExecutiveReportPackageSchema = z.object({
  contractVersion: z.literal(EXECUTIVE_REPORTING_CONTRACT_VERSION),
  templateId: z.enum(["project_steerco", "portfolio_review"]),
  scope: ReportScopeSchema,
  snapshot: SteercoSnapshotSchema,
  sourceFingerprint: z.string().min(8),
  review: z.object({ assignedTo: z.string().min(2), status: z.enum(["assigned", "approved", "rejected"]), rationale: z.string().optional(), decidedAt: z.string().datetime().optional() }),
  decisionRequests: z.array(DecisionRequestSchema),
  publicationHistory: z.array(PublicationReceiptSchema),
});

export type ExecutiveReportPackage = z.infer<typeof ExecutiveReportPackageSchema>;
export type ReportScope = z.infer<typeof ReportScopeSchema>;
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

function stableFingerprint(value: unknown) {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonical(nested)])) : item;
  const input = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function reportSourceFingerprint(snapshot: SteercoSnapshot) {
  return stableFingerprint({ snapshotId: snapshot.id, revision: snapshot.revision, sourceRevision: snapshot.sourceRevision, period: snapshot.period, modules: snapshot.reporting.modules });
}

export function buildExecutiveReportPackage(input: {
  snapshot: SteercoSnapshot; scope: ReportScope; reviewer: string; decisionRequests?: DecisionRequest[]; templateId?: "project_steerco" | "portfolio_review";
}): ExecutiveReportPackage {
  const templateId = input.templateId || (input.scope.targetKind === "portfolio" ? "portfolio_review" : "project_steerco");
  if ((templateId === "project_steerco") !== (input.scope.targetKind === "project")) throw new Error("Report template and governed target scope do not match.");
  if (input.scope.targetKind === "project" && input.scope.targetIds.length !== 1) throw new Error("A project report must bind exactly one project.");
  return ExecutiveReportPackageSchema.parse({
    contractVersion: EXECUTIVE_REPORTING_CONTRACT_VERSION, templateId, scope: input.scope,
    snapshot: input.snapshot, sourceFingerprint: reportSourceFingerprint(input.snapshot),
    review: { assignedTo: input.reviewer.trim(), status: "assigned" },
    decisionRequests: input.decisionRequests || [], publicationHistory: [],
  });
}

export function recordExecutiveReview(report: ExecutiveReportPackage, actor: string, decision: "approved" | "rejected", rationale: string, at = new Date().toISOString()) {
  if (actor.trim() !== report.review.assignedTo) throw new Error("Only the assigned reviewer can decide this report.");
  if (!rationale.trim()) throw new Error("Review rationale is required.");
  return ExecutiveReportPackageSchema.parse({ ...report, review: { assignedTo: report.review.assignedTo, status: decision, rationale: rationale.trim(), decidedAt: at } });
}

export function assertExecutiveReportPublishable(report: ExecutiveReportPackage, currentSnapshot: SteercoSnapshot) {
  if (report.scope.targetKind !== "project" || report.templateId !== "project_steerco") throw new Error("This publication boundary currently accepts project Steering Committee reports only.");
  if (report.review.status !== "approved" || report.snapshot.status !== "approved") throw new Error("Assigned reviewer approval and an approved immutable snapshot are required.");
  if (report.sourceFingerprint !== reportSourceFingerprint(currentSnapshot)) throw new Error("Report sources changed after review; regenerate and approve a new snapshot.");
  return true;
}

export function appendPublicationReceipt(report: ExecutiveReportPackage, action: "approved" | "published" | "revoked" | "restored", actor: string, reason?: string, at = new Date().toISOString()) {
  const previous = report.publicationHistory.at(-1);
  const receipt = PublicationReceiptSchema.parse({
    id: `report-receipt-${report.publicationHistory.length + 1}-${report.snapshot.revision}`, action, actor: actor.trim(), at,
    snapshotId: report.snapshot.id, snapshotRevision: report.snapshot.revision, sourceFingerprint: report.sourceFingerprint,
    reason: reason?.trim() || undefined, previousReceiptId: previous?.id,
  });
  return ExecutiveReportPackageSchema.parse({ ...report, publicationHistory: [...report.publicationHistory, receipt] });
}

export const PortfolioDecisionPackSchema = z.object({
  contractVersion: z.literal(EXECUTIVE_REPORTING_CONTRACT_VERSION), organisationId: z.string().min(8), generatedAt: z.string().datetime(),
  projects: z.array(z.object({ projectId: z.string().min(8), snapshotId: z.string(), revision: z.number().int(), rag: z.string(), approvedBy: z.string(), sourceFingerprint: z.string() })),
  attention: z.array(z.object({ projectId: z.string(), reason: z.string(), sourceIds: z.array(z.string()) })),
  missing: z.array(z.string()),
});

export function buildPortfolioDecisionPack(organisationId: string, sources: Array<{ projectId: string; snapshot?: SteercoSnapshot }>, at = new Date().toISOString()) {
  const missing = sources.filter((source) => !source.snapshot).map((source) => `${source.projectId}: no approved snapshot supplied.`);
  const approved = sources.flatMap((source) => source.snapshot && ["approved", "published", "revoked"].includes(source.snapshot.status) && source.snapshot.approvedBy ? [{ projectId: source.projectId, snapshot: source.snapshot }] : []);
  missing.push(...sources.filter((source) => source.snapshot && !approved.some((item) => item.projectId === source.projectId)).map((source) => `${source.projectId}: latest snapshot is not approved.`));
  return PortfolioDecisionPackSchema.parse({
    contractVersion: EXECUTIVE_REPORTING_CONTRACT_VERSION, organisationId, generatedAt: at,
    projects: approved.map(({ projectId, snapshot }) => ({ projectId, snapshotId: snapshot.id, revision: snapshot.revision, rag: snapshot.rag.effective, approvedBy: snapshot.approvedBy!, sourceFingerprint: reportSourceFingerprint(snapshot) })),
    attention: approved.flatMap(({ projectId, snapshot }) => snapshot.rag.effective === "red" || snapshot.rag.effective === "amber" ? [{ projectId, reason: `${snapshot.rag.effective.toUpperCase()} status requires portfolio attention.`, sourceIds: snapshot.rag.signals.flatMap((signal) => signal.sourceIds) }] : []),
    missing,
  });
}
