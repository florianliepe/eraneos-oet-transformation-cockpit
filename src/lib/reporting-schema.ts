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
  const status = blocked.length || openRisks.some((item) => item.probability * item.impact >= 16)
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
    ],
    claims: [
      { id: "project-phase", text: `${pmo.project.name} is in ${pmo.project.phase}.`, sourceIds: [pmo.project.id] },
    ],
    missingEvidence: pmo.milestones.length || pmo.deliverables.length || pmo.risks.length || pmo.meetings.length
      ? []
      : ["No governed delivery evidence has been recorded."],
  });
}
