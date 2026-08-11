import { readFileSync } from "node:fs";

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
if (!recovery.passed || recovery.destructiveActions !== false || recovery.scenarios.some((scenario) => !scenario.passed)) errors.push("Recovery rehearsal evidence is not current and passing.");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Operational quality verified: fail-closed telemetry, release gates, support boundary and recovery evidence.");
