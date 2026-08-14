import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sample = JSON.parse(readFileSync(resolve("docs/uat/evidence/zm-uat-02-la14-la15-2026-08-14.json"), "utf8"));
const budgets = JSON.parse(readFileSync(resolve("config/lean-runtime-budgets.json"), "utf8"));
const failures = [], warnings = [];
const routine = sample.reliabilityGate;
const mixed = sample.latencyGate;
if (routine.count < budgets.routine.minimumRuns) failures.push(`routine sample ${routine.count} < ${budgets.routine.minimumRuns}`);
if (routine.successRate < budgets.routine.minimumSuccessRate) failures.push(`routine success ${routine.successRate} < ${budgets.routine.minimumSuccessRate}`);
for (const metric of ["p50Ms", "p95Ms", "maxMs"]) if (routine[metric] > budgets.routine[metric]) failures.push(`routine ${metric} ${routine[metric]} > ${budgets.routine[metric]}`);
if (mixed.count < budgets.mixed.minimumRuns) failures.push(`mixed sample ${mixed.count} < ${budgets.mixed.minimumRuns}`);
for (const metric of ["p50Ms", "p95Ms"]) if (mixed[metric] > budgets.mixed[metric]) failures.push(`mixed ${metric} ${mixed[metric]} > ${budgets.mixed[metric]}`);
if (routine.p50Ms > budgets.improvementTargets.routineP50Ms) warnings.push(`routine P50 improvement target missed by ${routine.p50Ms - budgets.improvementTargets.routineP50Ms} ms`);
if (routine.p95Ms > budgets.improvementTargets.routineP95Ms) warnings.push(`routine P95 improvement target missed by ${routine.p95Ms - budgets.improvementTargets.routineP95Ms} ms`);
const report = {
  contractVersion: "lean-runtime-performance-report-1.0",
  capturedAt: sample.capturedAt,
  workflowId: sample.workflowId,
  routine: { count: routine.count, successRate: routine.successRate, p50Ms: routine.p50Ms, p95Ms: routine.p95Ms, meanMs: routine.meanMs, maxMs: routine.maxMs },
  mixed: { count: mixed.count, p50Ms: mixed.p50Ms, p95Ms: mixed.p95Ms, meanMs: mixed.meanMs },
  controlledFailureReceiptMs: sample.controlledFailure.receiptLatencyMs,
  budgets,
  failures,
  warnings,
  releaseReady: failures.length === 0,
};
const target = resolve("src/data/lean-runtime-performance-report.json");
if (process.argv.includes("--write")) { mkdirSync(resolve("src/data"), { recursive: true }); writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`); }
else if (!existsSync(target) || JSON.stringify(JSON.parse(readFileSync(target, "utf8"))) !== JSON.stringify(report)) failures.push("Committed runtime performance report is stale; run npm run build:runtime-performance-report.");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Lean runtime gate passed: routine P50 ${routine.p50Ms} ms, P95 ${routine.p95Ms} ms, success ${routine.successRate}; mixed P95 ${mixed.p95Ms} ms${warnings.length ? `; ${warnings.join("; ")}` : ""}.`);
