import { z } from "zod";
import type { PmoDocument } from "./pmo-schema";

export const ReportingClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
});

export const ReportingMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  status: z.enum(["green", "amber", "red", "unknown"]).optional(),
  sourceIds: z.array(z.string()).default([]),
});

export const ReportingModuleSummarySchema = z.object({
  moduleId: z.string().min(1),
  label: z.string().min(1),
  version: z.string().min(1),
  sourceRevision: z.number().int().min(1),
  freshness: z.string().datetime(),
  metrics: z.array(ReportingMetricSchema),
  claims: z.array(ReportingClaimSchema),
  missingEvidence: z.array(z.string()),
});

export type ReportingClaim = z.infer<typeof ReportingClaimSchema>;
export type ReportingMetric = z.infer<typeof ReportingMetricSchema>;
export type ReportingModuleSummary = z.infer<typeof ReportingModuleSummarySchema>;

export function buildCorePmoSummary(pmo: PmoDocument): ReportingModuleSummary {
  const openRisks = pmo.risks.filter((item) => item.state !== "closed");
  const blocked = pmo.deliverables.filter((item) => item.status === "blocked");
  const completed = pmo.deliverables.filter((item) => item.status === "done");
  const openIssues = pmo.issues.filter((item) => !["resolved", "closed"].includes(item.status));
  const openActions = pmo.actions.filter((item) => !["done", "cancelled"].includes(item.status));
  const pendingDecisions = pmo.decisions.filter((item) => ["proposed", "pending_approval"].includes(item.status));
  const pendingChanges = pmo.changeRequests.filter((item) => ["draft", "submitted", "under_review"].includes(item.status));
  const constrainedDependencies = pmo.dependencies.filter((item) => ["at_risk", "blocked"].includes(item.status));
  const status = blocked.length || constrainedDependencies.length || openIssues.some((item) => item.severity >= 4) || openRisks.some((item) => item.probability * item.impact >= 16)
    ? "red"
    : openRisks.length
      ? "amber"
      : pmo.deliverables.length
        ? "green"
        : "unknown";

  return ReportingModuleSummarySchema.parse({
    moduleId: "core-pmo",
    label: "Core PMO",
    version: "1.0.0",
    sourceRevision: pmo.revision,
    freshness: pmo.project.updatedAt,
    metrics: [
      { id: "delivery-progress", label: "Delivery progress", value: pmo.project.progress, status: pmo.project.overallRag === "grey" ? "unknown" : pmo.project.overallRag, sourceIds: [pmo.project.id] },
      { id: "deliverables-complete", label: "Completed deliverables", value: `${completed.length}/${pmo.deliverables.length}`, status, sourceIds: pmo.deliverables.map((item) => item.id) },
      { id: "open-risks", label: "Open risks", value: openRisks.length, status, sourceIds: openRisks.map((item) => item.id) },
      { id: "open-issues", label: "Open issues", value: openIssues.length, status, sourceIds: openIssues.map((item) => item.id) },
      { id: "open-actions", label: "Open actions", value: openActions.length, status, sourceIds: openActions.map((item) => item.id) },
      { id: "pending-decisions", label: "Pending decisions", value: pendingDecisions.length, status, sourceIds: pendingDecisions.map((item) => item.id) },
      { id: "pending-change-requests", label: "Pending change requests", value: pendingChanges.length, status, sourceIds: pendingChanges.map((item) => item.id) },
    ],
    claims: [
      { id: "project-phase", text: `${pmo.project.name} is in ${pmo.project.phase}.`, sourceIds: [pmo.project.id] },
    ],
    missingEvidence: pmo.milestones.length || pmo.deliverables.length || pmo.risks.length || pmo.issues.length || pmo.actions.length || pmo.decisions.length || pmo.evidence.length
      ? []
      : ["No governed delivery evidence has been recorded."],
  });
}
