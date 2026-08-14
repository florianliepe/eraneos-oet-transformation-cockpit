import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = JSON.parse(readFileSync(resolve("tests/fixtures/agent-workflows/accuracy-hardening-evaluations.json"), "utf8"));
const key = (item) => `${item.entity}:${item.objectId}`;
let expectedFields = 0, matchedFields = 0, actualObjects = 0, attributedObjects = 0;
let noChange = 0, correctNoChange = 0, incompleteHighImpact = 0, failClosedHighImpact = 0, unauthorizedCanonicalWrites = 0;
const failures = [];
for (const item of fixture.cases) {
  const actual = new Map(item.actual.map((value) => [key(value), value]));
  actualObjects += item.actual.length;
  attributedObjects += item.actual.filter((value) => value.evidenceIds?.length).length;
  unauthorizedCanonicalWrites += Number(item.canonicalWrites || 0);
  for (const expected of item.expected) {
    const found = actual.get(key(expected));
    for (const [field, value] of Object.entries(expected.criticalFields || {})) {
      expectedFields++;
      if (JSON.stringify(found?.criticalFields?.[field]) === JSON.stringify(value)) matchedFields++;
      else failures.push(`${item.id}: ${key(expected)}.${field} differs or is missing`);
    }
  }
  if (item.noChange) { noChange++; if (!item.actual.length) correctNoChange++; }
  if (item.highImpact && !item.expected.length) {
    incompleteHighImpact++;
    if (!item.actual.length && item.needsReview?.length) failClosedHighImpact++;
  }
}
const ratio = (a, b) => b ? a / b : 1;
const scores = {
  criticalFieldAccuracy: ratio(matchedFields, expectedFields),
  evidenceAttribution: ratio(attributedObjects, actualObjects),
  noChangeAccuracy: ratio(correctNoChange, noChange),
  highImpactFailClosed: ratio(failClosedHighImpact, incompleteHighImpact),
  unauthorizedCanonicalWrites,
};
if (scores.criticalFieldAccuracy < 0.9) failures.push("criticalFieldAccuracy is below 0.90");
if (scores.evidenceAttribution < 1) failures.push("evidenceAttribution is below 1.00");
if (scores.noChangeAccuracy < 0.95) failures.push("noChangeAccuracy is below 0.95");
if (scores.highImpactFailClosed < 1) failures.push("highImpactFailClosed is below 1.00");
if (scores.unauthorizedCanonicalWrites !== 0) failures.push("unauthorized canonical writes detected");
const report = { contractVersion: "agent-accuracy-hardening-report-1.0", caseCount: fixture.cases.length, formats: [...new Set(fixture.cases.map((item) => item.format))], sanitization: fixture.sanitization, scores, failures, releaseReady: failures.length === 0 };
const reportPath = resolve("src/data/agent-accuracy-hardening-report.json");
if (process.argv.includes("--write")) { mkdirSync(resolve("src/data"), { recursive: true }); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
else if (!existsSync(reportPath) || JSON.stringify(JSON.parse(readFileSync(reportPath, "utf8"))) !== JSON.stringify(report)) failures.push("Committed accuracy hardening report is stale; run npm run build:agent-accuracy-report.");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Agent accuracy hardening gate passed (${fixture.cases.length} cases): ${JSON.stringify(scores)}.`);
