import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const errors = [];
const pages = read(".github/workflows/deploy-pages.yml");
const app = read(".github/workflows/deploy-app-service.yml");
for (const [name, workflow] of [["Pages", pages], ["App Service validation", app]]) {
  for (const marker of ["npm audit --omit=dev --audit-level=high", "npm run test:accessibility", "npm run test:compatibility", "npm run verify:operational-quality"]) {
    if (!workflow.includes(marker)) errors.push(`${name} workflow is missing ${marker}.`);
  }
}
const telemetry = read("src/lib/product-telemetry.ts");
if (!telemetry.includes('NEXT_PUBLIC_PRODUCT_TELEMETRY_ENABLED !== "true"')) errors.push("Telemetry is not fail-closed by default.");
for (const path of ["config/performance-budgets.json", "docs/operations/pilot-support-runbook.md", "docs/operations/recovery-rehearsal.json", "docs/releases/2026-08-11-zm-prod-11-17.md"]) {
  try { read(path); } catch { errors.push(`Required operational evidence is missing: ${path}.`); }
}
const recovery = JSON.parse(read("docs/operations/recovery-rehearsal.json"));
if (recovery.contractVersion !== "recovery-rehearsal-1.1") errors.push("Recovery rehearsal contract is not version 1.1.");
const performedAt = Date.parse(recovery.performedAt);
const ageDays = (Date.now() - performedAt) / 86_400_000;
if (!Number.isFinite(performedAt) || ageDays < 0 || ageDays > 30) errors.push("Recovery rehearsal evidence is invalid, future-dated or older than 30 days.");
if (!recovery.passed || recovery.destructiveActions !== false || !Array.isArray(recovery.scenarios) || recovery.scenarios.length < 4 || recovery.scenarios.some((scenario) => !scenario.passed)) errors.push("Recovery rehearsal evidence is not current and passing.");
const scenarioNames = recovery.scenarios?.map((scenario) => scenario.name) || [];
if (new Set(scenarioNames).size !== scenarioNames.length) errors.push("Recovery rehearsal scenario names must be unique.");
const allowedCommands = new Set(["npm run test:e2e", "npm run verify:workflow-release", "npm run verify:release"]);
for (const scenario of recovery.scenarios || []) {
  if (scenario.evidence?.kind === "path" && !existsSync(scenario.evidence.reference)) errors.push(`Recovery evidence path does not exist: ${scenario.evidence.reference}.`);
  else if (scenario.evidence?.kind === "command" && !allowedCommands.has(scenario.evidence.reference)) errors.push(`Recovery evidence command is not approved: ${scenario.evidence.reference}.`);
  else if (!["path", "command", "github_actions"].includes(scenario.evidence?.kind)) errors.push(`Recovery scenario ${scenario.name} has no verifiable evidence type.`);
  if (scenario.evidence?.kind === "github_actions" && (!/^\d{8,}$/.test(String(scenario.evidence.runId)) || !/^[0-9a-f]{40}$/.test(String(scenario.evidence.commitSha)))) errors.push(`Recovery scenario ${scenario.name} has invalid GitHub Actions evidence.`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Operational quality verified: fail-closed telemetry, release gates, support boundary and recovery evidence.");
