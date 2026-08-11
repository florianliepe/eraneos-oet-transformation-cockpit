import { z } from "zod";
import type { PmoDocument } from "./pmo-schema";
import { ReportingModuleSummarySchema, type ReportingModuleSummary } from "./reporting-schema";

export const SteercoPeriodSchema = z.object({
  preset: z.enum(["current_month", "previous_month", "since_last_steerco", "project_phase", "custom", "latest_approved"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1),
});

export const SteercoClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["fact", "metric", "ai_narrative", "human_override", "missing"]),
  sourceIds: z.array(z.string()).default([]),
  material: z.boolean().optional(),
  judgementBasis: z.string().min(1).optional(),
});

export const SteercoEvidenceEnvelopeSchema = z.object({
  project: z.custom<PmoDocument>(),
  modules: z.array(ReportingModuleSummarySchema),
  reportingPeriod: SteercoPeriodSchema,
  generatedAt: z.string().datetime(),
});

const sections = z.object({
  milestones: z.array(SteercoClaimSchema),
  deliverables: z.array(SteercoClaimSchema),
  risks: z.array(SteercoClaimSchema),
  issues: z.array(SteercoClaimSchema),
  decisions: z.array(SteercoClaimSchema),
  overdueActions: z.array(SteercoClaimSchema),
  dependencies: z.array(SteercoClaimSchema),
  assumptions: z.array(SteercoClaimSchema),
  changeRequests: z.array(SteercoClaimSchema),
  upcoming: z.array(SteercoClaimSchema),
  changes: z.array(SteercoClaimSchema),
  moduleHighlights: z.array(SteercoClaimSchema),
  governance: z.array(SteercoClaimSchema),
  automation: z.array(SteercoClaimSchema),
  benefits: z.array(SteercoClaimSchema).default([]),
  finances: z.array(SteercoClaimSchema).default([]),
  scenarios: z.array(SteercoClaimSchema).default([]),
});

export const SteercoModuleSchema = z.enum(["delivery", "risks", "decisions", "benefits", "finances", "scenarios"]);
export const SteercoTrendSchema = z.object({
  id: z.string(), label: z.string(), current: z.number(), previous: z.number().optional(), unit: z.string(),
  direction: z.enum(["improving", "stable", "deteriorating", "new"]), sourceIds: z.array(z.string()), explanation: z.string(),
});

export const SteercoSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().min(1),
  revision: z.number().int().positive(),
  status: z.enum(["draft", "in_review", "rejected", "approved", "published", "revoked"]),
  period: SteercoPeriodSchema,
  generatedAt: z.string().datetime(),
  generatedBy: z.string().min(1),
  generatedWith: z.object({ model: z.string(), promptVersion: z.string(), rulesVersion: z.string() }),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
  approvalReason: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  sourceRevision: z.object({ pmo: z.number().int(), modules: z.record(z.string(), z.number().int()) }),
  dataFreshness: z.object({ lastSynchronizedAt: z.string().datetime(), stale: z.boolean(), notes: z.array(z.string()) }),
  reporting: z.object({
    modules: z.array(SteercoModuleSchema),
    trends: z.array(SteercoTrendSchema),
    materialChanges: z.array(SteercoClaimSchema),
  }).default({ modules: ["delivery", "risks", "decisions", "benefits", "finances", "scenarios"], trends: [], materialChanges: [] }),
  rag: z.object({
    calculated: z.enum(["green", "amber", "red", "unknown"]),
    effective: z.enum(["green", "amber", "red", "unknown"]),
    signals: z.array(z.object({ id: z.string(), severity: z.enum(["green", "amber", "red", "unknown"]), label: z.string(), sourceIds: z.array(z.string()) })),
    override: z.object({ value: z.enum(["green", "amber", "red", "unknown"]), actor: z.string(), reason: z.string(), at: z.string().datetime() }).optional(),
  }),
  executiveSummary: z.array(SteercoClaimSchema),
  sections,
  publication: z.object({ shareId: z.string().optional(), expiresAt: z.string().datetime().optional(), revokedAt: z.string().datetime().optional(), checksum: z.string().optional(), githubPath: z.string().optional(), githubCommit: z.string().optional(), classification: z.literal("steerco_read_only") }),
  audit: z.array(z.object({ id: z.string(), event: z.string(), actor: z.string(), at: z.string().datetime(), reason: z.string().optional() })),
});

export type SteercoPeriod = z.infer<typeof SteercoPeriodSchema>;
export type SteercoClaim = z.infer<typeof SteercoClaimSchema>;
export type SteercoEvidenceEnvelope = z.infer<typeof SteercoEvidenceEnvelopeSchema>;
export type SteercoSnapshot = z.infer<typeof SteercoSnapshotSchema>;
export type SteercoRag = SteercoSnapshot["rag"]["effective"];
export type SteercoModule = z.infer<typeof SteercoModuleSchema>;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00Z`);
const claim = (id: string, text: string, kind: SteercoClaim["kind"], sourceIds: string[] = [], material = kind !== "missing"): SteercoClaim => ({ id, text, kind, sourceIds, material });

export function resolveSteercoPeriod(preset: SteercoPeriod["preset"], pmo: PmoDocument, now = new Date(), custom?: Pick<SteercoPeriod, "from" | "to">): SteercoPeriod {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  if (preset === "custom" && custom) return { preset, ...custom, label: `${custom.from} to ${custom.to}` };
  if (preset === "previous_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { preset, from: isoDate(from), to: isoDate(to), label: "Previous month" };
  }
  if (preset === "since_last_steerco") {
    const prior = [...pmo.meetings].filter((meeting) => meeting.type === "steering" && dateAtNoon(meeting.date) <= now).sort((a, b) => b.date.localeCompare(a.date))[0];
    return { preset, from: prior?.date || isoDate(monthStart), to: isoDate(now), label: prior ? `Since ${prior.title}` : "Since month start" };
  }
  if (preset === "project_phase") return { preset, from: pmo.project.startDate, to: pmo.project.endDate, label: pmo.project.phase };
  if (preset === "latest_approved") return { preset, from: isoDate(monthStart), to: isoDate(now), label: "Latest approved snapshot" };
  return { preset: "current_month", from: isoDate(monthStart), to: isoDate(monthEnd), label: "Current month" };
}

export function buildSteercoEnvelope(pmo: PmoDocument, modules: ReportingModuleSummary[], period: SteercoPeriod, now = new Date()): SteercoEvidenceEnvelope {
  return SteercoEvidenceEnvelopeSchema.parse({ project: pmo, modules, reportingPeriod: period, generatedAt: now.toISOString() });
}

export function buildSteercoEvidence(envelope: SteercoEvidenceEnvelope, actor: string, selectedModules: SteercoModule[] = ["delivery", "risks", "decisions", "benefits", "finances", "scenarios"]): SteercoSnapshot {
  const { project: pmo, modules, reportingPeriod: period } = envelope;
  if (period.from > period.to) throw new Error("Reporting period start must be on or before its end.");
  const now = new Date(envelope.generatedAt);
  const inPeriod = (value: string) => value.slice(0, 10) >= period.from && value.slice(0, 10) <= period.to;
  const openRisks = pmo.risks.filter((item) => item.state !== "closed");
  const criticalRisks = openRisks.filter((item) => item.probability * item.impact >= 16);
  const blockedDeliverables = pmo.deliverables.filter((item) => item.status === "blocked");
  const overdueDeliverables = pmo.deliverables.filter((item) => item.status !== "done" && item.dueDate < isoDate(now));
  const overdueActions = pmo.actions.filter((item) => !["done", "cancelled"].includes(item.status) && item.dueDate < isoDate(now));
  const criticalIssues = pmo.issues.filter((item) => !["resolved", "closed"].includes(item.status) && item.severity >= 4);
  const atRiskDependencies = pmo.dependencies.filter((item) => ["at_risk", "blocked"].includes(item.status));
  const invalidAssumptions = pmo.assumptions.filter((item) => item.status === "invalidated");
  const missingEvidence = modules.flatMap((module) => module.missingEvidence);
  const stale = now.getTime() - new Date(pmo.project.updatedAt).getTime() > 7 * 86_400_000;
  const signals: SteercoSnapshot["rag"]["signals"] = [];
  const insufficient = !pmo.milestones.length && !pmo.deliverables.length && !pmo.risks.length && !pmo.issues.length && !pmo.actions.length && !pmo.decisions.length;
  if (insufficient) signals.push({ id: "insufficient-evidence", severity: "unknown", label: "Insufficient governed project evidence for a defensible status", sourceIds: [pmo.project.id] });
  if (criticalRisks.length) signals.push({ id: "critical-risks", severity: "red", label: `${criticalRisks.length} critical unresolved risk(s)`, sourceIds: criticalRisks.map((item) => item.id) });
  if (blockedDeliverables.length) signals.push({ id: "blocked-deliverables", severity: "red", label: `${blockedDeliverables.length} blocked deliverable(s)`, sourceIds: blockedDeliverables.map((item) => item.id) });
  if (criticalIssues.length) signals.push({ id: "critical-issues", severity: "red", label: `${criticalIssues.length} critical unresolved issue(s)`, sourceIds: criticalIssues.map((item) => item.id) });
  if (atRiskDependencies.length) signals.push({ id: "at-risk-dependencies", severity: "red", label: `${atRiskDependencies.length} at-risk or blocked dependency/dependencies`, sourceIds: atRiskDependencies.map((item) => item.id) });
  if (invalidAssumptions.length) signals.push({ id: "invalid-assumptions", severity: "amber", label: `${invalidAssumptions.length} invalid assumption(s)`, sourceIds: invalidAssumptions.map((item) => item.id) });
  if (overdueDeliverables.length) signals.push({ id: "overdue-deliverables", severity: "amber", label: `${overdueDeliverables.length} overdue deliverable(s)`, sourceIds: overdueDeliverables.map((item) => item.id) });
  if (missingEvidence.length) signals.push({ id: "module-evidence-gaps", severity: "unknown", label: `${missingEvidence.length} module evidence gap(s)`, sourceIds: modules.map((module) => module.moduleId) });
  if (stale) signals.push({ id: "stale-data", severity: "amber", label: "Project source is older than seven days", sourceIds: [pmo.project.id] });
  if (!signals.length) signals.push({ id: "within-tolerance", severity: "green", label: "No critical delivery or governance signals detected", sourceIds: [pmo.project.id] });
  const calculated: SteercoRag = insufficient ? "unknown" : signals.some((item) => item.severity === "red") ? "red" : signals.some((item) => item.severity === "amber") ? "amber" : signals.some((item) => item.severity === "unknown") ? "unknown" : "green";
  const section = (items: SteercoClaim[], empty: string) => items.length ? items : [claim(`missing-${empty.toLowerCase().replaceAll(" ", "-")}`, empty, "missing")];
  const decisions = pmo.decisions.filter((item) => inPeriod(item.decisionDate)).map((item) => claim(item.id, `${item.title}: ${item.decision}`, "fact", [item.id]));
  const forecastCost = pmo.financials.reduce((sum, item) => sum + item.forecast, 0);
  const baselineCost = pmo.financials.reduce((sum, item) => sum + item.baseline, 0);
  const forecastBenefit = pmo.benefits.reduce((sum, item) => sum + item.forecast, 0);
  const targetBenefit = pmo.benefits.reduce((sum, item) => sum + item.target, 0);
  const materialChanges = [
    forecastCost !== baselineCost ? claim("change-cost", `Forecast cost differs from baseline by ${forecastCost - baselineCost}.`, "metric", pmo.financials.map((item) => item.id)) : null,
    forecastBenefit !== targetBenefit ? claim("change-benefit", `Forecast benefits differ from target by ${forecastBenefit - targetBenefit}.`, "metric", pmo.benefits.map((item) => item.id)) : null,
    ...pmo.audit.filter((item) => inPeriod(item.timestamp)).slice(0, 4).map((item) => claim(`change-${item.id}`, item.message, "fact", [item.object.id])),
  ].filter((item): item is SteercoClaim => item !== null);

  return SteercoSnapshotSchema.parse({
    schemaVersion: "1.0.0", id: `STEERCO-${Date.now()}`, revision: 1, status: "draft", period, generatedAt: envelope.generatedAt, generatedBy: actor,
    generatedWith: { model: "pending-governed-ai", promptVersion: "steerco-prompt-1.0.0", rulesVersion: "steerco-rag-1.0.0" },
    sourceRevision: { pmo: pmo.revision, modules: Object.fromEntries(modules.map((module) => [module.moduleId, module.sourceRevision])) },
    dataFreshness: { lastSynchronizedAt: pmo.project.updatedAt, stale, notes: stale ? ["Project data is older than seven days."] : [] },
    reporting: {
      modules: selectedModules,
      trends: [
        { id: "delivery-progress", label: "Delivery progress", current: pmo.project.progress, unit: "%", direction: "new", sourceIds: [pmo.project.id], explanation: "Current governed project progress; comparison becomes available when a prior approved snapshot is selected." },
        { id: "cost-variance", label: "Forecast cost variance", current: forecastCost - baselineCost, unit: pmo.financials[0]?.currency || "currency", direction: forecastCost > baselineCost ? "deteriorating" : forecastCost < baselineCost ? "improving" : "stable", sourceIds: pmo.financials.map((item) => item.id), explanation: "Forecast minus approved baseline across governed financial records." },
        { id: "benefit-gap", label: "Forecast benefit gap", current: forecastBenefit - targetBenefit, unit: pmo.benefits[0]?.unit || "value", direction: forecastBenefit < targetBenefit ? "deteriorating" : forecastBenefit > targetBenefit ? "improving" : "stable", sourceIds: pmo.benefits.map((item) => item.id), explanation: "Forecast minus target across governed benefit records." },
      ],
      materialChanges,
    },
    rag: { calculated, effective: calculated, signals },
    executiveSummary: [claim("ai-pending", "AI narrative has not yet been generated. Verified metrics and source records are ready for the governed generation step.", "missing", [pmo.project.id])],
    sections: {
      milestones: section(pmo.milestones.filter((item) => inPeriod(item.date)).map((item) => claim(item.id, `${item.title}: ${item.status.replaceAll("_", " ")} on ${item.date}.`, "fact", [item.id])), "No milestone changes in this period."),
      deliverables: section(pmo.deliverables.filter((item) => inPeriod(item.dueDate)).map((item) => claim(item.id, `${item.title}: ${item.progress}% complete, ${item.status.replaceAll("_", " ")}.`, "fact", [item.id])), "No deliverables fall in this period."),
      risks: section(openRisks.slice(0, 5).map((item) => claim(item.id, `${item.title}: exposure ${item.probability * item.impact}, ${item.state}.`, "fact", [item.id])), "No open risks recorded."),
      issues: section(pmo.issues.filter((item) => !["resolved", "closed"].includes(item.status)).slice(0, 5).map((item) => claim(item.id, `${item.title}: severity ${item.severity}, ${item.status}.`, "fact", [item.id])), "No open issues recorded."),
      decisions: section(decisions, "No decisions captured in this period."),
      overdueActions: section(overdueActions.map((item) => claim(item.id, `${item.title} — ${item.owner}, due ${item.dueDate}.`, "fact", [item.id])), "No overdue actions detected."),
      dependencies: section(atRiskDependencies.map((item) => claim(item.id, `${item.title}: ${item.status}, needed by ${item.neededBy}.`, "fact", [item.id])), "No at-risk dependencies recorded."),
      assumptions: section(pmo.assumptions.filter((item) => item.status !== "validated").map((item) => claim(item.id, `${item.title}: ${item.status}, validate by ${item.validationDueDate}.`, "fact", [item.id])), "No assumptions awaiting validation."),
      changeRequests: section(pmo.changeRequests.filter((item) => !["approved", "rejected", "withdrawn"].includes(item.status)).map((item) => claim(item.id, `${item.title}: ${item.status}, ${item.priority}.`, "fact", [item.id])), "No pending change requests."),
      upcoming: section(pmo.milestones.filter((item) => item.status !== "complete" && item.date > period.to).slice(0, 5).map((item) => claim(item.id, `${item.title} on ${item.date}.`, "fact", [item.id])), "No upcoming milestone recorded."),
      changes: section(pmo.audit.filter((item) => inPeriod(item.timestamp)).slice(0, 8).map((item) => claim(item.id, item.message, "fact", [item.object.id])), "No recorded project changes in this period."),
      moduleHighlights: section(modules.flatMap((module) => module.metrics.map((metric) => claim(`${module.moduleId}:${metric.id}`, `${module.label} — ${metric.label}: ${metric.value}.`, "metric", metric.sourceIds.length ? metric.sourceIds : [pmo.project.id]))), "No reporting module summaries supplied."),
      governance: missingEvidence.length ? missingEvidence.map((text, index) => claim(`module-gap-${index + 1}`, text, "missing")) : [claim("domain-governance", `${pmo.evidence.length} evidence record(s), ${pmo.reviews.length} review(s), ${pmo.audit.length} audit event(s), and ${pmo.objectVersions.length} immutable object version(s) available.`, "metric", [...pmo.evidence.map((item) => item.id), ...pmo.reviews.map((item) => item.id)])],
      automation: [claim("automation-evidence", "Runtime automation health requires evidence from the protected orchestration boundary.", "missing")],
      benefits: section(pmo.benefits.map((item) => claim(item.id, `${item.title}: forecast ${item.forecast} ${item.unit} against target ${item.target} ${item.unit}.`, "metric", [item.id])), "No benefit records supplied."),
      finances: section(pmo.financials.map((item) => claim(item.id, `${item.title}: forecast ${item.forecast} ${item.currency} against baseline ${item.baseline} ${item.currency}.`, "metric", [item.id])), "No financial records supplied."),
      scenarios: section(pmo.scenarios.map((item) => claim(item.id, `${item.title}: ${item.status.replaceAll("_", " ")}; schedule ${item.scheduleDeltaDays} days, cost ${item.costDelta}, benefit ${item.benefitDelta}.`, "fact", [item.id])), "No governed scenarios supplied."),
    },
    publication: { classification: "steerco_read_only" },
    audit: [{ id: `AUD-${Date.now()}`, event: "steerco.draft_created", actor, at: envelope.generatedAt }],
  });
}

export function assertSteercoSourcesCurrent(snapshot: SteercoSnapshot, pmo: PmoDocument, modules: ReportingModuleSummary[]) {
  const currentModules = Object.fromEntries(modules.map((module) => [module.moduleId, module.sourceRevision]));
  if (snapshot.sourceRevision.pmo !== pmo.revision || JSON.stringify(snapshot.sourceRevision.modules) !== JSON.stringify(currentModules)) {
    throw new Error("Source drift detected. Regenerate the report from the latest governed project and module revisions.");
  }
}

export function applySteercoApproval(snapshot: SteercoSnapshot, actor: string, reason: string): SteercoSnapshot {
  if (!actor.trim() || !reason.trim()) throw new Error("Approver and approval reason are required.");
  if (snapshot.executiveSummary.some((item) => item.kind === "missing")) throw new Error("Generate and review the AI executive summary before approval.");
  const claims = [...snapshot.executiveSummary, ...Object.values(snapshot.sections).flat(), ...snapshot.reporting.materialChanges];
  if (claims.some((item) => item.material !== false && !item.sourceIds.length && !(item.kind === "human_override" && item.judgementBasis))) {
    throw new Error("Every material claim requires linked evidence or an explicitly documented human judgement basis.");
  }
  const at = new Date().toISOString();
  return { ...snapshot, status: "approved", approvedAt: at, approvedBy: actor.trim(), approvalReason: reason.trim(), audit: [...snapshot.audit, { id: `AUD-${Date.now()}`, event: "steerco.approved", actor: actor.trim(), at, reason: reason.trim() }] };
}

export function compareSteercoPeriods(current: SteercoSnapshot, previous: SteercoSnapshot): SteercoSnapshot {
  const previousById = new Map(previous.reporting.trends.map((item) => [item.id, item]));
  return {
    ...current,
    reporting: {
      ...current.reporting,
      trends: current.reporting.trends.map((item) => {
        const prior = previousById.get(item.id)?.current;
        if (prior === undefined) return item;
        const delta = item.current - prior;
        return { ...item, previous: prior, direction: delta === 0 ? "stable" : item.id === "delivery-progress" ? (delta > 0 ? "improving" : "deteriorating") : item.direction, explanation: `${item.explanation} Previous approved period: ${prior} ${item.unit}; change: ${delta} ${item.unit}.` };
      }),
    },
  };
}

export function applySteercoRagOverride(snapshot: SteercoSnapshot, value: SteercoRag, actor: string, reason: string): SteercoSnapshot {
  if (!actor.trim() || !reason.trim()) throw new Error("Override actor and evidence-based reason are required.");
  const at = new Date().toISOString();
  return { ...snapshot, rag: { ...snapshot.rag, effective: value, override: { value, actor: actor.trim(), reason: reason.trim(), at } }, audit: [...snapshot.audit, { id: `AUD-${Date.now()}`, event: "steerco.rag_overridden", actor: actor.trim(), at, reason: reason.trim() }] };
}

export function rejectSteercoDraft(snapshot: SteercoSnapshot, actor: string, reason: string): SteercoSnapshot {
  if (!actor.trim() || !reason.trim()) throw new Error("Reviewer and rejection reason are required.");
  const at = new Date().toISOString();
  return { ...snapshot, status: "rejected", revision: snapshot.revision + 1, audit: [...snapshot.audit, { id: `AUD-${Date.now()}`, event: "steerco.rejected", actor: actor.trim(), at, reason: reason.trim() }] };
}
